import type { SampleResult } from '../types/sampleFinder'

interface SampleResultRowProps {
  result: SampleResult
  isPlaying: boolean
  isLoading: boolean
  onPreview: (result: SampleResult) => void
  onLoad: (result: SampleResult) => void
}

export function SampleResultRow({ result, isPlaying, isLoading, onPreview, onLoad }: SampleResultRowProps) {
  return (
    <div className={`sample-result-row${isPlaying ? ' previewing' : ''}`}>
      <span className="sample-result-name" title={result.name}>
        {result.name}
      </span>
      {result.bpm != null && (
        <span className="sample-bpm-chip">{result.bpm} BPM</span>
      )}
      <div className="sample-result-actions">
        <button
          className={`sample-preview-btn${isPlaying ? ' playing' : ''}`}
          onClick={() => onPreview(result)}
          title={isPlaying ? 'Pause preview' : 'Preview'}
        >
          {isPlaying ? '■' : '▶'}
        </button>
        <button
          className="sample-load-btn"
          onClick={() => onLoad(result)}
          disabled={isLoading}
          title="Load into loop"
        >
          {isLoading ? '...' : 'LOAD'}
        </button>
      </div>
    </div>
  )
}
