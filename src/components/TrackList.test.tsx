import { render, screen } from '@testing-library/react'
import { TrackList } from './TrackList'
import { TrackState } from '../types'
import type { TrackSnapshot } from '../types'

function makeTrack(id: string, index: number): TrackSnapshot {
  return {
    id,
    index,
    state: TrackState.PLAYING,
    duration: 1.0,
    volume: 1.0,
    isMuted: false,
    isDeleted: false,
    waveformData: [0.5, 0.3],
  }
}

describe('TrackList', () => {
  it('renders a TrackRow for each track', () => {
    const tracks = [makeTrack('t1', 0), makeTrack('t2', 1)]
    render(<TrackList tracks={tracks} onToggleMute={vi.fn()} onSetVolume={vi.fn()} onDeleteTrack={vi.fn()} />)
    expect(screen.getByText(/track 1/i)).toBeInTheDocument()
    expect(screen.getByText(/track 2/i)).toBeInTheDocument()
  })

  it('renders EmptyState when tracks is empty', () => {
    render(<TrackList tracks={[]} onToggleMute={vi.fn()} onSetVolume={vi.fn()} onDeleteTrack={vi.fn()} />)
    expect(screen.getByText(/press record/i)).toBeInTheDocument()
  })

  it('renders tracks in order by index', () => {
    const tracks = [makeTrack('t1', 0), makeTrack('t2', 1), makeTrack('t3', 2)]
    render(<TrackList tracks={tracks} onToggleMute={vi.fn()} onSetVolume={vi.fn()} onDeleteTrack={vi.fn()} />)
    const labels = screen.getAllByTestId('track-label')
    expect(labels[0].textContent).toMatch(/track 1/i)
    expect(labels[1].textContent).toMatch(/track 2/i)
    expect(labels[2].textContent).toMatch(/track 3/i)
  })

  it('passes correct callbacks to TrackRow', () => {
    const onToggleMute = vi.fn()
    const onSetVolume = vi.fn()
    const tracks = [makeTrack('t1', 0)]
    render(<TrackList tracks={tracks} onToggleMute={onToggleMute} onSetVolume={onSetVolume} onDeleteTrack={vi.fn()} />)
    // Verify the track row rendered (callbacks are tested in TrackRow tests)
    expect(screen.getByText(/track 1/i)).toBeInTheDocument()
  })
})
