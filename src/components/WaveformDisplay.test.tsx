import { render, screen } from '@testing-library/react'
import { WaveformDisplay } from './WaveformDisplay'
import { TrackState } from '../types'

describe('WaveformDisplay', () => {
  it('renders a canvas element', () => {
    render(<WaveformDisplay waveformData={[0.5, 0.3]} state={TrackState.PLAYING} />)
    expect(screen.getByTestId('waveform-canvas')).toBeInTheDocument()
  })

  it('applies playing class when state is PLAYING', () => {
    render(<WaveformDisplay waveformData={[0.5]} state={TrackState.PLAYING} />)
    const container = screen.getByTestId('waveform-display')
    expect(container.classList.contains('playing')).toBe(true)
  })

  it('applies recording class when state is RECORDING', () => {
    render(<WaveformDisplay waveformData={[0.5]} state={TrackState.RECORDING} />)
    const container = screen.getByTestId('waveform-display')
    expect(container.classList.contains('recording')).toBe(true)
  })

  it('applies muted class when state is MUTED', () => {
    render(<WaveformDisplay waveformData={[0.5]} state={TrackState.MUTED} />)
    const container = screen.getByTestId('waveform-display')
    expect(container.classList.contains('muted')).toBe(true)
  })

  it('renders without crashing when waveformData is empty', () => {
    render(<WaveformDisplay waveformData={[]} state={TrackState.PLAYING} />)
    expect(screen.getByTestId('waveform-canvas')).toBeInTheDocument()
  })

  it('renders playhead line when currentPosition provided', () => {
    render(
      <WaveformDisplay
        waveformData={[0.5, 0.3]}
        state={TrackState.PLAYING}
        currentPosition={0.5}
      />
    )
    expect(screen.getByTestId('waveform-playhead')).toBeInTheDocument()
  })

  it('does not render playhead when currentPosition not provided', () => {
    render(<WaveformDisplay waveformData={[0.5]} state={TrackState.PLAYING} />)
    expect(screen.queryByTestId('waveform-playhead')).not.toBeInTheDocument()
  })
})
