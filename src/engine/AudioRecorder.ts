import { concatFloat32Arrays } from '../utils/audioHelpers'
import { MIC_GET_USER_MEDIA_OPTIONS } from './micConstraints'

// Inline AudioWorklet processor code as a blob URL
// This runs on the audio thread and sends samples back to the main thread
const WORKLET_CODE = `
class RecorderProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._recording = false;
    this._warmupDone = false;  // skip leading silence from stream startup
    this.port.onmessage = (e) => {
      if (e.data.command === 'start') {
        this._recording = true;
        this._warmupDone = false;  // reset for each new recording
      }
      if (e.data.command === 'stop') {
        this._recording = false;
        // Send a sentinel so the main thread knows no more samples are coming
        this.port.postMessage({ type: 'stopped' });
      }
    };
  }

  process(inputs) {
    if (!this._recording) return true;
    const input = inputs[0];
    if (!input || !input[0] || input[0].length === 0) return true;

    const samples = input[0];

    // Skip silent warmup frames — the browser buffers ~1s of silence when a
    // MediaStreamAudioSourceNode first starts delivering samples to the graph.
    // Only start recording once we see actual audio above the noise floor.
    if (!this._warmupDone) {
      for (let i = 0; i < samples.length; i++) {
        if (Math.abs(samples[i]) > 0.001) {
          this._warmupDone = true;
          break;
        }
      }
      if (!this._warmupDone) return true;
    }

    const copy = new Float32Array(samples);
    this.port.postMessage({ samples: copy }, [copy.buffer]);
    return true;
  }
}

registerProcessor('recorder-processor', RecorderProcessor);
`

export class AudioRecorder {
  private audioContext: AudioContext
  private mediaStream: MediaStream | null = null
  private sourceNode: MediaStreamAudioSourceNode | null = null
  private workletNode: AudioWorkletNode | null = null
  private analyserNode: AnalyserNode | null = null
  private silentOutput: GainNode | null = null
  private recordedChunks: Float32Array[] = []
  private _isRecording = false
  private workletReady = false
  private peakBuffer: Float32Array | null = null

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext
  }

  get isRecording(): boolean {
    return this._isRecording
  }

  get hasStream(): boolean {
    return this.mediaStream !== null
  }

  get usesWorklet(): boolean {
    return this.workletReady
  }

  async requestMicAccess(): Promise<void> {
    this.mediaStream = await navigator.mediaDevices.getUserMedia(MIC_GET_USER_MEDIA_OPTIONS)

    // Register the AudioWorklet processor
    try {
      const blob = new Blob([WORKLET_CODE], { type: 'application/javascript' })
      const url = URL.createObjectURL(blob)
      await this.audioContext.audioWorklet.addModule(url)
      URL.revokeObjectURL(url)
      this.workletReady = true
    } catch {
      // Fallback: worklet not supported, will use ScriptProcessor
      console.warn('[AudioRecorder] AudioWorklet not available, using ScriptProcessor fallback')
      this.workletReady = false
    }

    this.setupMicGraph()
  }

  startCapture(onFirstSample?: () => void, onSamples?: (samples: Float32Array) => void): void {
    if (!this.mediaStream) {
      throw new Error('Microphone access not granted. Call requestMicAccess() first.')
    }

    this.setupMicGraph()

    const audioTracks = this.mediaStream.getAudioTracks()
    console.log('[AudioRecorder] startCapture - Stream tracks:', audioTracks.length,
      '| Track states:', audioTracks.map(t => t.readyState),
      '| AudioContext state:', this.audioContext.state,
      '| WorkletReady:', this.workletReady)

    this.recordedChunks = []
    this._isRecording = true

    if (this.workletReady) {
      console.log('[AudioRecorder] Using AudioWorklet path')
      this.startWorkletCapture(onFirstSample, onSamples)
    } else {
      console.log('[AudioRecorder] Using ScriptProcessor fallback')
      this.startScriptProcessorCapture(onFirstSample, onSamples)
    }
  }

  private setupMicGraph(): void {
    if (!this.mediaStream || this.sourceNode) return

    this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream)
    this.analyserNode = this.audioContext.createAnalyser()
    this.analyserNode.fftSize = 2048
    this.analyserNode.smoothingTimeConstant = 0.3
    this.sourceNode.connect(this.analyserNode)
  }

  /** Zero-gain output so capture nodes run without audible mic monitoring / feedback. */
  private getSilentOutput(): GainNode {
    if (!this.silentOutput) {
      this.silentOutput = this.audioContext.createGain()
      this.silentOutput.gain.value = 0
      this.silentOutput.connect(this.audioContext.destination)
    }
    return this.silentOutput
  }

  private startWorkletCapture(onFirstSample?: () => void, onSamples?: (samples: Float32Array) => void): void {
    this.workletNode = new AudioWorkletNode(this.audioContext, 'recorder-processor')
    let firstSampleFired = false
    this.workletNode.port.onmessage = (e: MessageEvent) => {
      if (e.data.type === 'stopped') {
        this._isRecording = false
        if (this.workletNode) {
          this.workletNode.disconnect()
          this.workletNode = null
        }
        return
      }

      if (!e.data.samples) return

      if (!firstSampleFired && onFirstSample) {
        onFirstSample()
        firstSampleFired = true
      }

      const samples = new Float32Array(e.data.samples)
      this.recordedChunks.push(samples)
      onSamples?.(samples)
    }
    this.workletNode.port.postMessage({ command: 'start' })
    this.sourceNode!.connect(this.workletNode)
    this.workletNode.connect(this.getSilentOutput())
  }

  private scriptProcessorNode: ScriptProcessorNode | null = null

  private startScriptProcessorCapture(onFirstSample?: () => void, onSamples?: (samples: Float32Array) => void): void {
    this.scriptProcessorNode = this.audioContext.createScriptProcessor(4096, 1, 1)
    let warmupDone = false
    let firstSampleFired = false
    this.scriptProcessorNode.onaudioprocess = (event) => {
      if (!this._isRecording) return

      const inputData = event.inputBuffer.getChannelData(0)

      if (!warmupDone) {
        for (let i = 0; i < inputData.length; i++) {
          if (Math.abs(inputData[i]) > 0.001) { warmupDone = true; break }
        }
        if (!warmupDone) return
      }

      if (!firstSampleFired && onFirstSample) {
        onFirstSample()
        firstSampleFired = true
      }

      const chunk = new Float32Array(inputData.length)
      chunk.set(inputData)
      this.recordedChunks.push(chunk)
      onSamples?.(chunk)
    }
    this.sourceNode!.connect(this.scriptProcessorNode)
    this.scriptProcessorNode.connect(this.getSilentOutput())
  }

  stopCapture(): Float32Array {
    if (this.workletNode) {
      this.workletNode.port.postMessage({ command: 'stop' })
    }

    if (this.scriptProcessorNode) {
      this._isRecording = false
      this.scriptProcessorNode.onaudioprocess = null
      this.scriptProcessorNode.disconnect()
      this.scriptProcessorNode = null
    }

    const result = concatFloat32Arrays(this.recordedChunks)
    this.recordedChunks = []
    return result
  }

  getAnalyserNode(): AnalyserNode | null {
    return this.analyserNode
  }

  /** Peak input level from the mic (0–1). Available after requestMicAccess(). */
  getInputPeakLevel(): number {
    if (!this.analyserNode) return 0

    if (!this.peakBuffer || this.peakBuffer.length !== this.analyserNode.fftSize) {
      this.peakBuffer = new Float32Array(this.analyserNode.fftSize)
    }

    this.analyserNode.getFloatTimeDomainData(this.peakBuffer as Float32Array<ArrayBuffer>)
    let peak = 0
    for (let i = 0; i < this.peakBuffer.length; i++) {
      const abs = Math.abs(this.peakBuffer[i])
      if (abs > peak) peak = abs
    }
    return peak
  }

  dispose(): void {
    if (this._isRecording) {
      this.stopCapture()
    }

    if (this.workletNode) {
      this.workletNode.disconnect()
      this.workletNode = null
    }

    if (this.scriptProcessorNode) {
      this.scriptProcessorNode.disconnect()
      this.scriptProcessorNode = null
    }

    if (this.sourceNode) {
      this.sourceNode.disconnect()
      this.sourceNode = null
    }

    if (this.silentOutput) {
      this.silentOutput.disconnect()
      this.silentOutput = null
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop())
      this.mediaStream = null
    }

    this.analyserNode = null
    this.peakBuffer = null
  }
}
