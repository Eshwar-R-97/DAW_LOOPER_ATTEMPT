export class TrackEffects {
  private reverbAmount = 0
  private _pitchOctaves = 0
  private _pitchRatio = 1.0  // precomputed 2^_pitchOctaves — never computed in hot loop
  private readonly delayLengths = [2205, 2910, 3780, 4410]
  private readonly feedback = 0.75
  private delayBuffers: Float32Array[]
  private writePositions: number[]

  constructor() {
    this.delayBuffers = this.delayLengths.map((len) => new Float32Array(len))
    this.writePositions = [0, 0, 0, 0]
  }

  setReverb(amount: number): void {
    this.reverbAmount = Math.max(0, Math.min(1, amount))
  }

  getReverb(): number {
    return this.reverbAmount
  }

  setPitch(octaves: number): void {
    this._pitchOctaves = Math.max(-4, Math.min(4, octaves))
    this._pitchRatio = Math.pow(2, this._pitchOctaves)
  }

  getPitchOctaves(): number {
    return this._pitchOctaves
  }

  getPitchRatio(): number {
    return this._pitchRatio
  }

  process(input: number): number {
    if (this.reverbAmount === 0) return input

    let wetSum = 0
    for (let i = 0; i < 4; i++) {
      const buf = this.delayBuffers[i]
      const len = this.delayLengths[i]
      const wp = this.writePositions[i]
      const rp = (wp + 1) % len
      const delayed = buf[rp]
      buf[wp] = input + delayed * this.feedback
      wetSum += delayed
      this.writePositions[i] = (wp + 1) % len
    }

    const wet = wetSum / 4
    return input * (1 - this.reverbAmount) + wet * this.reverbAmount
  }

  reset(): void {
    this.delayBuffers.forEach((b) => b.fill(0))
    this.writePositions.fill(0)
  }
}
