import { concatFloat32Arrays } from '../utils/audioHelpers'

// Inline AudioWorklet processor code as a blob URL
// This runs on the audio thread and sends samples back to the main thread
const WORKLET_CODE = `
class RecorderProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._recording = false;
    this.port.onmessage = (e) => {
      if (e.data.command === 'start') this._recording = true;
      if (e.data.command === 'stop') this._recording = false;
    };
  }

  process(inputs) {
    if (!this._recording) return true;
    const input = inputs[0];
    if (input && input[0] && input[0].length > 0) {
      // Copy the data and send to main thread
      const samples = new Float32Array(input[0]);
      this.port.postMessage({ samples }, [samples.buffer]);
    }
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

  startCapture(): void {
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
      this.startWorkletCapture()
    } else {
      console.log('[AudioRecorder] Using ScriptProcessor fallback')
      this.startScriptProcessorCapture()
    }
  }

  private startWorkletCapture(): void {
    this.workletNode = new AudioWorkletNode(this.audioContext, 'recorder-processor')
    let messageCount = 0
    this.workletNode.port.onmessage = (e: MessageEvent) => {
      messageCount++
      if (messageCount <= 3) {
        console.log('[AudioRecorder] Worklet message #' + messageCount,
          '| isRecording:', this._isRecording,
          '| hasSamples:', !!e.data.samples,
          '| sampleLength:', e.data.samples?.length)
      }
      if (!this._isRecording) return
      if (e.data.samples) {
        this.recordedChunks.push(new Float32Array(e.data.samples))
      }
    }
    this.workletNode.port.postMessage({ command: 'start' })
    this.sourceNode!.connect(this.workletNode)
    console.log('[AudioRecorder] Worklet node connected to source')
  }

  private scriptProcessorNode: ScriptProcessorNode | null = null

  private startScriptProcessorCapture(): void {
    this.scriptProcessorNode = this.audioContext.createScriptProcessor(4096, 1, 1)
    let processCount = 0
    this.scriptProcessorNode.onaudioprocess = (event) => {
      processCount++
      if (processCount <= 3) {
        const inputData = event.inputBuffer.getChannelData(0)
        const maxVal = Math.max(...Array.from(inputData).map(Math.abs))
        console.log('[AudioRecorder] ScriptProcessor event #' + processCount,
          '| isRecording:', this._isRecording,
          '| samples:', inputData.length,
          '| maxAmplitude:', maxVal.toFixed(6))
      }
      if (!this._isRecording) return
      const inputData = event.inputBuffer.getChannelData(0)
      const chunk = new Float32Array(inputData.length)
      chunk.set(inputData)
      this.recordedChunks.push(chunk)
    }
    this.sourceNode!.connect(this.scriptProcessorNode)
    // ScriptProcessor must be connected to destination to fire
    this.scriptProcessorNode.connect(this.audioContext.destination)
    console.log('[AudioRecorder] ScriptProcessor connected to source and destination')
  }

  stopCapture(): Float32Array {
    console.log('[AudioRecorder] stopCapture - chunks:', this.recordedChunks.length,
      '| wasRecording:', this._isRecording,
      '| hasWorkletNode:', !!this.workletNode,
      '| hasScriptProcessor:', !!this.scriptProcessorNode)
    this._isRecording = false

    if (this.workletNode) {
      this.workletNode.port.postMessage({ command: 'stop' })
      this.workletNode.disconnect()
      this.workletNode = null
    }

    if (this.scriptProcessorNode) {
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
