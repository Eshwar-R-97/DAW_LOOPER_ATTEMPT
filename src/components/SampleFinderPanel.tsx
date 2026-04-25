// UNTESTED — SampleFinderPanel depends on api/search-samples.ts and api/preview-proxy.ts
// which require vercel dev + a live TINYFISH_API_KEY. UI rendering is untested in browser.
import { useState, useRef, useCallback } from 'react'
import type { SampleResult, SearchStatus } from '../types/sampleFinder'
import { SampleResultRow } from './SampleResultRow'

const GENRE_OPTIONS = [
  '', 'boom bap', 'lo-fi', 'trap', 'house', 'techno',
  'drum & bass', 'ambient', 'jazz', 'soul', 'funk', 'rock', 'cinematic',
]

type ActiveTab = 'freesound' | 'looperman'

interface ResultsBySource {
  freesound: SampleResult[]
  looperman: SampleResult[]
}

interface SampleFinderPanelProps {
  onLoadSample: (url: string) => Promise<void>
}

export function SampleFinderPanel({ onLoadSample }: SampleFinderPanelProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [bpm, setBpm] = useState('')
  const [genre, setGenre] = useState('')
  const [status, setStatus] = useState<SearchStatus>('idle')
  const [resultsBySource, setResultsBySource] = useState<ResultsBySource>({ freesound: [], looperman: [] })
  const [activeTab, setActiveTab] = useState<ActiveTab>('freesound')
  const [error, setError] = useState<string | null>(null)
  const [activePreviewId, setActivePreviewId] = useState<string | null>(null)
  const [loadingTrackId, setLoadingTrackId] = useState<string | null>(null)

  const audioRef = useRef<HTMLAudioElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const firstResultSourceRef = useRef<ActiveTab | null>(null)

  const handleSearch = useCallback(async () => {
    if (!prompt.trim()) return

    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac
    firstResultSourceRef.current = null

    setStatus('searching')
    setResultsBySource({ freesound: [], looperman: [] })
    setError(null)

    const params = new URLSearchParams({ prompt: prompt.trim() })
    if (bpm) params.set('bpm', bpm)
    if (genre) params.set('genre', genre)

    try {
      const res = await fetch(`/api/search-samples?${params}`, { signal: ac.signal })
      if (!res.ok || !res.body) throw new Error(`Search failed: ${res.status}`)

      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
      let buf = ''

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buf += value
        const lines = buf.split('\n')
        buf = lines.pop()!

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          let payload: { type: string; data?: SampleResult; message?: string; source?: string }
          try {
            payload = JSON.parse(line.slice(6)) as typeof payload
          } catch {
            continue
          }

          if (payload.type === 'done') {
            setStatus('done')
            break
          }
          if (payload.type === 'error') {
            setError(payload.message ?? 'Unknown error')
            setStatus('error')
            break
          }
          if (payload.type === 'result' && payload.data) {
            const result = payload.data
            setResultsBySource((prev) => ({
              ...prev,
              [result.source]: [...prev[result.source], result],
            }))
            // Auto-switch tab to whichever source gets the first result
            if (!firstResultSourceRef.current && (result.source === 'freesound' || result.source === 'looperman')) {
              firstResultSourceRef.current = result.source
              setActiveTab(result.source)
            }
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setError((err as Error).message)
        setStatus('error')
      } else {
        setStatus('idle')
      }
    }
  }, [prompt, bpm, genre])

  const handleCancel = useCallback(() => {
    abortRef.current?.abort()
    setStatus('idle')
  }, [])

  const handlePreview = useCallback((result: SampleResult) => {
    const audio = audioRef.current
    if (!audio) return
    if (activePreviewId === result.id && !audio.paused) {
      audio.pause()
      setActivePreviewId(null)
    } else {
      audio.src = result.previewUrl
      void audio.play()
      setActivePreviewId(result.id)
    }
  }, [activePreviewId])

  const handleLoad = useCallback(async (result: SampleResult) => {
    setLoadingTrackId(result.id)
    try {
      await onLoadSample(result.downloadUrl ?? result.previewUrl)
    } finally {
      setLoadingTrackId(null)
    }
  }, [onLoadSample])

  const activeResults = resultsBySource[activeTab]
  const totalFreesound = resultsBySource.freesound.length
  const totalLooperman = resultsBySource.looperman.length
  const hasAnyResults = totalFreesound > 0 || totalLooperman > 0

  return (
    <div className="sample-finder-panel">
      <div className="sample-finder-header" onClick={() => setIsOpen((o) => !o)}>
        <span className="sample-finder-title">Vibe Sample Finder</span>
        <span className="sample-finder-toggle">{isOpen ? 'collapse ▲' : 'expand ▼'}</span>
      </div>

      {isOpen && (
        <div className="sample-finder-body">
          <div className="sample-finder-form">
            <input
              className="sample-finder-prompt"
              type="text"
              placeholder="dark rainy boom bap, lo-fi midnight, afrobeats summer energy…"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void handleSearch() }}
            />
            <div className="sample-finder-row">
              <input
                className="sample-finder-bpm"
                type="number"
                placeholder="BPM"
                min="40"
                max="300"
                value={bpm}
                onChange={(e) => setBpm(e.target.value)}
              />
              <select
                className="sample-finder-genre"
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
              >
                {GENRE_OPTIONS.map((g) => (
                  <option key={g} value={g}>{g === '' ? 'Genre (any)' : g}</option>
                ))}
              </select>
              {status === 'searching' ? (
                <button className="sample-finder-cancel-btn" onClick={handleCancel}>
                  Cancel
                </button>
              ) : (
                <button
                  className="sample-finder-search-btn"
                  onClick={() => void handleSearch()}
                  disabled={!prompt.trim()}
                >
                  Search
                </button>
              )}
            </div>
          </div>

          {status === 'searching' && !hasAnyResults && (
            <div className="sample-finder-status searching">Searching…</div>
          )}
          {status === 'error' && error && (
            <div className="sample-finder-status error">{error}</div>
          )}
          {status === 'done' && !hasAnyResults && (
            <div className="sample-finder-status">No results found</div>
          )}

          {hasAnyResults && (
            <>
              <div className="sample-finder-tabs">
                <button
                  className={`sample-finder-tab${activeTab === 'freesound' ? ' active' : ''}`}
                  onClick={() => setActiveTab('freesound')}
                >
                  Freesound {totalFreesound > 0 && <span className="tab-count">({totalFreesound})</span>}
                </button>
                <button
                  className={`sample-finder-tab${activeTab === 'looperman' ? ' active' : ''}`}
                  onClick={() => setActiveTab('looperman')}
                >
                  Looperman {totalLooperman > 0 && <span className="tab-count">({totalLooperman})</span>}
                </button>
              </div>

              <div className="sample-finder-results">
                {activeResults.length === 0 ? (
                  <div className="sample-finder-status">
                    {status === 'searching' ? 'Waiting for results…' : 'No results from this source'}
                  </div>
                ) : (
                  activeResults.map((result) => (
                    <SampleResultRow
                      key={result.id}
                      result={result}
                      isPlaying={activePreviewId === result.id}
                      isLoading={loadingTrackId === result.id}
                      onPreview={handlePreview}
                      onLoad={(r) => void handleLoad(r)}
                    />
                  ))
                )}
              </div>
            </>
          )}

          <audio
            ref={audioRef}
            onEnded={() => setActivePreviewId(null)}
            style={{ display: 'none' }}
          />
        </div>
      )}
    </div>
  )
}
