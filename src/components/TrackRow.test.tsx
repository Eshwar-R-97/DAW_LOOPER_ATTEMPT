import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TrackRow } from './TrackRow'
import { TrackState } from '../types'
import type { TrackSnapshot } from '../types'

function makeTrack(overrides?: Partial<TrackSnapshot>): TrackSnapshot {
  return {
    id: 'track-1',
    index: 0,
    state: TrackState.PLAYING,
    duration: 1.0,
    volume: 1.0,
    isMuted: false,
    isDeleted: false,
    waveformData: [0.5, 0.3, 0.7, 0.2],
    ...overrides,
  }
}

describe('TrackRow', () => {
  it('displays the track label with correct number', () => {
    render(<TrackRow track={makeTrack({ index: 0 })} onToggleMute={vi.fn()} onSetVolume={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByText(/track 1/i)).toBeInTheDocument()
  })

  it('displays correct number for track index 2', () => {
    render(<TrackRow track={makeTrack({ index: 2 })} onToggleMute={vi.fn()} onSetVolume={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByText(/track 3/i)).toBeInTheDocument()
  })

  it('shows recording indicator when state is RECORDING', () => {
    render(<TrackRow track={makeTrack({ state: TrackState.RECORDING })} onToggleMute={vi.fn()} onSetVolume={vi.fn()} onDelete={vi.fn()} />)
    const indicator = screen.getByTestId('track-state-indicator')
    expect(indicator.classList.contains('recording')).toBe(true)
  })

  it('shows playing indicator when state is PLAYING', () => {
    render(<TrackRow track={makeTrack({ state: TrackState.PLAYING })} onToggleMute={vi.fn()} onSetVolume={vi.fn()} onDelete={vi.fn()} />)
    const indicator = screen.getByTestId('track-state-indicator')
    expect(indicator.classList.contains('playing')).toBe(true)
  })

  it('shows muted indicator when state is MUTED', () => {
    render(<TrackRow track={makeTrack({ state: TrackState.MUTED })} onToggleMute={vi.fn()} onSetVolume={vi.fn()} onDelete={vi.fn()} />)
    const indicator = screen.getByTestId('track-state-indicator')
    expect(indicator.classList.contains('muted')).toBe(true)
  })

  it('renders a mute toggle button', () => {
    render(<TrackRow track={makeTrack()} onToggleMute={vi.fn()} onSetVolume={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByRole('button', { name: /mute/i })).toBeInTheDocument()
  })

  it('calls onToggleMute when mute button clicked', async () => {
    const user = userEvent.setup()
    const onToggleMute = vi.fn()
    render(<TrackRow track={makeTrack()} onToggleMute={onToggleMute} onSetVolume={vi.fn()} onDelete={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: /mute/i }))
    expect(onToggleMute).toHaveBeenCalledTimes(1)
  })

  it('mute button shows "Mute" when playing and "Unmute" when muted', () => {
    const { rerender } = render(
      <TrackRow track={makeTrack({ state: TrackState.PLAYING, isMuted: false })} onToggleMute={vi.fn()} onSetVolume={vi.fn()} onDelete={vi.fn()} />
    )
    expect(screen.getByRole('button', { name: /^mute$/i })).toBeInTheDocument()

    rerender(
      <TrackRow track={makeTrack({ state: TrackState.MUTED, isMuted: true })} onToggleMute={vi.fn()} onSetVolume={vi.fn()} onDelete={vi.fn()} />
    )
    expect(screen.getByRole('button', { name: /unmute/i })).toBeInTheDocument()
  })

  it('renders a volume knob', () => {
    render(<TrackRow track={makeTrack()} onToggleMute={vi.fn()} onSetVolume={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByRole('slider', { name: /vol/i })).toBeInTheDocument()
  })

  it('volume knob reflects current track volume', () => {
    render(<TrackRow track={makeTrack({ volume: 0.7 })} onToggleMute={vi.fn()} onSetVolume={vi.fn()} onDelete={vi.fn()} />)
    const knob = screen.getByRole('slider', { name: /vol/i })
    expect(Number(knob.getAttribute('aria-valuenow'))).toBeCloseTo(0.7)
  })

  it('volume knob is interactive', () => {
    const onSetVolume = vi.fn()
    render(<TrackRow track={makeTrack()} onToggleMute={vi.fn()} onSetVolume={onSetVolume} onDelete={vi.fn()} />)
    const knob = screen.getByRole('slider', { name: /vol/i })
    expect(knob).toBeInTheDocument()
  })

  it('renders a delete button', () => {
    render(<TrackRow track={makeTrack()} onToggleMute={vi.fn()} onSetVolume={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument()
  })

  it('calls onDelete when delete button clicked', async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn()
    render(<TrackRow track={makeTrack()} onToggleMute={vi.fn()} onSetVolume={vi.fn()} onDelete={onDelete} />)
    await user.click(screen.getByRole('button', { name: /delete/i }))
    expect(onDelete).toHaveBeenCalledTimes(1)
  })
})
