import { render, screen } from '@testing-library/react'
import { LoopProgressBar } from './LoopProgressBar'

describe('LoopProgressBar', () => {
  it('renders a progress bar element', () => {
    render(<LoopProgressBar currentPosition={0} isPlaying={false} />)
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('sets width to 0% when position is 0', () => {
    render(<LoopProgressBar currentPosition={0} isPlaying={false} />)
    const fill = screen.getByTestId('progress-fill')
    expect(fill.style.width).toBe('0%')
  })

  it('sets width to 50% when position is 0.5', () => {
    render(<LoopProgressBar currentPosition={0.5} isPlaying={false} />)
    const fill = screen.getByTestId('progress-fill')
    expect(fill.style.width).toBe('50%')
  })

  it('sets width to 100% when position is 1.0', () => {
    render(<LoopProgressBar currentPosition={1} isPlaying={false} />)
    const fill = screen.getByTestId('progress-fill')
    expect(fill.style.width).toBe('100%')
  })

  it('has active styling when isPlaying is true', () => {
    render(<LoopProgressBar currentPosition={0.5} isPlaying={true} />)
    const bar = screen.getByRole('progressbar')
    expect(bar.classList.contains('active')).toBe(true)
  })

  it('has inactive styling when isPlaying is false', () => {
    render(<LoopProgressBar currentPosition={0.5} isPlaying={false} />)
    const bar = screen.getByRole('progressbar')
    expect(bar.classList.contains('active')).toBe(false)
  })
})
