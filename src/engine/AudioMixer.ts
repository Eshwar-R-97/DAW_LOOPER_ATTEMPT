import { AudioTrack } from './AudioTrack'
import { clamp } from '../utils/audioHelpers'

export class AudioMixer {
  private masterVolume: number

  constructor(masterVolume = 1.0) {
    this.masterVolume = clamp(masterVolume, 0.0, 2.0)
  }

  setMasterVolume(value: number): void {
    this.masterVolume = clamp(value, 0.0, 2.0)
  }

  getMasterVolume(): number {
    return this.masterVolume
  }

  mixSample(tracks: AudioTrack[], position: number): number {
    let sum = 0
    for (const track of tracks) {
      sum += track.getSample(position)
    }
    return clamp(sum * this.masterVolume, -1.0, 1.0)
  }

  mixTracks(tracks: AudioTrack[], position: number, bufferLength: number): Float32Array {
    const output = new Float32Array(bufferLength)

    for (let i = 0; i < bufferLength; i++) {
      let sum = 0
      for (const track of tracks) {
        sum += track.getSample(position + i)
      }
      output[i] = clamp(sum * this.masterVolume, -1.0, 1.0)
    }

    return output
  }
}
