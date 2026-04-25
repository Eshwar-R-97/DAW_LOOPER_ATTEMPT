import { concatFloat32Arrays } from '../utils/audioHelpers'

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
  private recordedChunks: Float32Array[] = []
  private _isRecording = false
  private workletReady = false

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
    this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true })

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
  }

  startCapture(onFirstSample?: () => void): void {
    if (!this.mediaStream) {
      throw new Error('Microphone access not granted. Call requestMicAccess() first.')
    }

    // Verify the media stream is still active
    const audioTracks = this.mediaStream.getAudioTracks()
    console.log('[AudioRecorder] startCapture - Stream tracks:', audioTracks.length,
      '| Track states:', audioTracks.map(t => t.readyState),
      '| AudioContext state:', this.audioContext.state,
      '| WorkletReady:', this.workletReady)

    this.recordedChunks = []
    this._isRecording = true

    this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream)
    this.analyserNode = this.audioContext.createAnalyser() as AnalyserNode
    this.sourceNode.connect(this.analyserNode)

    if (this.workletReady) {
      console.log('[AudioRecorder] Using AudioWorklet path')
      this.startWorkletCapture(onFirstSample)
    } else {
      console.log('[AudioRecorder] Using ScriptProcessor fallback')
      this.startScriptProcessorCapture(onFirstSample)
    }
  }

  private startWorkletCapture(onFirstSample?: () => void): void {
    this.workletNode = new AudioWorkletNode(this.audioContext, 'recorder-processor')
    let firstSampleFired = false
    this.workletNode.port.onmessage = (e: MessageEvent) => {
      // 'stopped' sentinel: the worklet has finished — do final cleanup
      if (e.data.type === 'stopped') {
        this._isRecording = false
        if (this.workletNode) {
          this.workletNode.disconnect()
          this.workletNode = null
        }
        return
      }

      // Don't drop samples here based on _isRecording — messages sent before
      // the worklet processed 'stop' are still valid audio and must be kept.
      // The worklet's own flag stops it generating new messages; we just drain
      // whatever is already in the message queue.
      if (!e.data.samples) return

      // First non-silent sample arriving: fire the sync callback
      if (!firstSampleFired && onFirstSample) {
        onFirstSample()
        firstSampleFired = true
      }

      this.recordedChunks.push(new Float32Array(e.data.samples))
    }
    this.workletNode.port.postMessage({ command: 'start' })
    this.sourceNode!.connect(this.workletNode)
  }

  private scriptProcessorNode: ScriptProcessorNode | null = null

  private startScriptProcessorCapture(onFirstSample?: () => void): void {
    this.scriptProcessorNode = this.audioContext.createScriptProcessor(4096, 1, 1)
    let warmupDone = false
    let firstSampleFired = false
    this.scriptProcessorNode.onaudioprocess = (event) => {
      if (!this._isRecording) return

      const inputData = event.inputBuffer.getChannelData(0)

      // Skip leading silence same as the worklet path
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
    }
    this.sourceNode!.connect(this.scriptProcessorNode)
    this.scriptProcessorNode.connect(this.audioContext.destination)
  }

  stopCapture(): Float32Array {
    if (this.workletNode) {
      // Tell the worklet to stop generating samples. It will send a 'stopped'
      // sentinel message when done, which the onmessage handler uses to do
      // final disconnect — so we don't disconnect here. Any samples already
      // sent by the worklet but not yet received will still arrive and be
      // collected before 'stopped' is processed.
      this.workletNode.port.postMessage({ command: 'stop' })
      // _isRecording is cleared by the 'stopped' sentinel handler
    }

    if (this.scriptProcessorNode) {
      this._isRecording = false
      this.scriptProcessorNode.onaudioprocess = null
      this.scriptProcessorNode.disconnect()
      this.scriptProcessorNode = null
    }

    if (this.sourceNode) {
      this.sourceNode.disconnect()
      this.sourceNode = null
    }

    const result = concatFloat32Arrays(this.recordedChunks)
    this.recordedChunks = []
    return result
  }

  getAnalyserNode(): AnalyserNode | null {
    return this.analyserNode
  }

  dispose(): void {
    if (this._isRecording) {
      this.stopCapture()
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop())
      this.mediaStream = null
    }

    this.analyserNode = null
  }
}
