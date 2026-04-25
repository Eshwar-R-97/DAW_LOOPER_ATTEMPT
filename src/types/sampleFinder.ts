export interface SampleResult {
  id: string
  source: 'freesound' | 'looperman'
  name: string
  previewUrl: string
  downloadUrl?: string
  bpm?: number
  tags: string[]
  duration?: number
  sourceUrl: string
}

export type SearchStatus = 'idle' | 'searching' | 'done' | 'error'
