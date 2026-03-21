import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TransportBar } from './TransportBar'
import { LooperState } from '../types'

const defaultProps = {
  looperState: LooperState.EMPTY,
  onRecord: vi.fn(),
  onPlayStop: vi.fn(),
  onUndo: vi.fn(),
  onRedo: vi.fn(),
  canUndo: false,
  canRedo: false,
}

describe('TransportBar', () => {
  describe('Record Button', () => {
    it('renders a record button', () => {
      render(<TransportBar {...defaultProps} />)
      expect(screen.getByTestId('record-button')).toBeInTheDocument()
    })

    it('calls onRecord when clicked', async () => {
      const user = userEvent.setup()
      const onRecord = vi.fn()
      render(<TransportBar {...defaultProps} onRecord={onRecord} />)
      await user.click(screen.getByTestId('record-button'))
      expect(onRecord).toHaveBeenCalledTimes(1)
    })

    it('has recording class when looperState is RECORDING', () => {
      render(<TransportBar {...defaultProps} looperState={LooperState.RECORDING} />)
      expect(screen.getByTestId('record-button').classList.contains('recording')).toBe(true)
    })

    it('shows "Record" text when not recording', () => {
      render(<TransportBar {...defaultProps} looperState={LooperState.EMPTY} />)
      expect(screen.getByTestId('record-button')).toHaveTextContent(/record/i)
    })

    it('shows "Stop Recording" text when recording', () => {
      render(<TransportBar {...defaultProps} looperState={LooperState.RECORDING} />)
      expect(screen.getByTestId('record-button')).toHaveTextContent(/stop rec/i)
    })
  })

  describe('Play/Stop Button', () => {
    it('renders a play/stop button', () => {
      render(<TransportBar {...defaultProps} />)
      expect(screen.getByTestId('play-stop-button')).toBeInTheDocument()
    })

    it('shows "Play" when stopped', () => {
      render(<TransportBar {...defaultProps} looperState={LooperState.STOPPED} />)
      expect(screen.getByTestId('play-stop-button')).toHaveTextContent(/play/i)
    })

    it('shows "Stop" when playing', () => {
      render(<TransportBar {...defaultProps} looperState={LooperState.PLAYING} />)
      expect(screen.getByTestId('play-stop-button')).toHaveTextContent(/stop/i)
    })

    it('calls onPlayStop when clicked', async () => {
      const user = userEvent.setup()
      const onPlayStop = vi.fn()
      render(<TransportBar {...defaultProps} looperState={LooperState.PLAYING} onPlayStop={onPlayStop} />)
      await user.click(screen.getByTestId('play-stop-button'))
      expect(onPlayStop).toHaveBeenCalledTimes(1)
    })

    it('is disabled when looperState is EMPTY', () => {
      render(<TransportBar {...defaultProps} looperState={LooperState.EMPTY} />)
      expect(screen.getByTestId('play-stop-button')).toBeDisabled()
    })
  })

  describe('Undo/Redo', () => {
    it('renders undo button', () => {
      render(<TransportBar {...defaultProps} />)
      expect(screen.getByTestId('undo-button')).toBeInTheDocument()
    })

    it('renders redo button', () => {
      render(<TransportBar {...defaultProps} />)
      expect(screen.getByTestId('redo-button')).toBeInTheDocument()
    })

    it('undo is disabled when canUndo is false', () => {
      render(<TransportBar {...defaultProps} canUndo={false} />)
      expect(screen.getByTestId('undo-button')).toBeDisabled()
    })

    it('redo is disabled when canRedo is false', () => {
      render(<TransportBar {...defaultProps} canRedo={false} />)
      expect(screen.getByTestId('redo-button')).toBeDisabled()
    })

    it('undo is enabled when canUndo is true', () => {
      render(<TransportBar {...defaultProps} canUndo={true} />)
      expect(screen.getByTestId('undo-button')).not.toBeDisabled()
    })

    it('calls onUndo when undo clicked', async () => {
      const user = userEvent.setup()
      const onUndo = vi.fn()
      render(<TransportBar {...defaultProps} canUndo={true} onUndo={onUndo} />)
      await user.click(screen.getByTestId('undo-button'))
      expect(onUndo).toHaveBeenCalledTimes(1)
    })

    it('calls onRedo when redo clicked', async () => {
      const user = userEvent.setup()
      const onRedo = vi.fn()
      render(<TransportBar {...defaultProps} canRedo={true} onRedo={onRedo} />)
      await user.click(screen.getByTestId('redo-button'))
      expect(onRedo).toHaveBeenCalledTimes(1)
    })
  })

  describe('State Indicator', () => {
    it('shows "Ready to record" when EMPTY', () => {
      render(<TransportBar {...defaultProps} looperState={LooperState.EMPTY} />)
      expect(screen.getByTestId('state-indicator')).toHaveTextContent(/ready to record/i)
    })

    it('shows "Recording..." when RECORDING', () => {
      render(<TransportBar {...defaultProps} looperState={LooperState.RECORDING} />)
      expect(screen.getByTestId('state-indicator')).toHaveTextContent(/recording/i)
    })

    it('shows "Playing" when PLAYING', () => {
      render(<TransportBar {...defaultProps} looperState={LooperState.PLAYING} />)
      expect(screen.getByTestId('state-indicator')).toHaveTextContent(/playing/i)
    })

    it('shows "Stopped" when STOPPED', () => {
      render(<TransportBar {...defaultProps} looperState={LooperState.STOPPED} />)
      expect(screen.getByTestId('state-indicator')).toHaveTextContent(/stopped/i)
    })
  })
})
