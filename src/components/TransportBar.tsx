import { LooperState } from '../types'

interface TransportBarProps {
  looperState: LooperState
  onRecord: () => void
  onPlayStop: () => void
  onUndo: () => void
  onRedo: () => void
  canUndo: boolean
  canRedo: boolean
}

const STATE_LABELS: Record<LooperState, string> = {
  [LooperState.EMPTY]: 'Ready to record',
  [LooperState.RECORDING]: 'Recording...',
  [LooperState.PLAYING]: 'Playing',
  [LooperState.STOPPED]: 'Stopped',
}

export function TransportBar({
  looperState,
  onRecord,
  onPlayStop,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}: TransportBarProps) {
  const isRecording = looperState === LooperState.RECORDING
  const isPlaying = looperState === LooperState.PLAYING
  const isEmpty = looperState === LooperState.EMPTY

  return (
    <div className="transport-bar">
      <div className="transport-buttons">
        <button
          className={`transport-button record-button ${isRecording ? 'recording' : ''}`}
          data-testid="record-button"
          onClick={onRecord}
        >
          {isRecording ? 'Stop Rec' : 'Record'}
        </button>

        <button
          className="transport-button play-stop-button"
          data-testid="play-stop-button"
          onClick={onPlayStop}
          disabled={isEmpty}
        >
          {isPlaying ? 'Stop' : 'Play'}
        </button>

        <button
          className="transport-button undo-button"
          data-testid="undo-button"
          onClick={onUndo}
          disabled={!canUndo}
        >
          Undo
        </button>

        <button
          className="transport-button redo-button"
          data-testid="redo-button"
          onClick={onRedo}
          disabled={!canRedo}
        >
          Redo
        </button>
      </div>

      <div className="state-indicator" data-testid="state-indicator">
        {STATE_LABELS[looperState]}
      </div>
    </div>
  )
}
