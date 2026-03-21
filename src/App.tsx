import { useEffect, useCallback } from 'react'
import { useLooperStore } from './store/useLooperStore'
import { LooperState } from './types'
import { TransportBar } from './components/TransportBar'
import { LoopProgressBar } from './components/LoopProgressBar'
import { TrackList } from './components/TrackList'

function App() {
  const looperState = useLooperStore((s) => s.looperState)
  const tracks = useLooperStore((s) => s.tracks)
  const masterLoopLength = useLooperStore((s) => s.masterLoopLength)
  const currentPosition = useLooperStore((s) => s.currentPosition)
  const error = useLooperStore((s) => s.error)

  const initializeEngine = useLooperStore((s) => s.initializeEngine)
  const startRecording = useLooperStore((s) => s.startRecording)
  const stopRecording = useLooperStore((s) => s.stopRecording)
  const playAll = useLooperStore((s) => s.playAll)
  const stopAll = useLooperStore((s) => s.stopAll)
  const toggleTrackMute = useLooperStore((s) => s.toggleTrackMute)
  const setTrackVolume = useLooperStore((s) => s.setTrackVolume)
  const undoLastTrack = useLooperStore((s) => s.undoLastTrack)
  const redoTrack = useLooperStore((s) => s.redoTrack)
  const latencyOffsetMs = useLooperStore((s) => s.latencyOffsetMs)
  const setLatencyOffset = useLooperStore((s) => s.setLatencyOffset)
  const dispose = useLooperStore((s) => s.dispose)

  useEffect(() => {
    initializeEngine()
    return () => dispose()
  }, [initializeEngine, dispose])

  const handleRecord = useCallback(() => {
    if (looperState === LooperState.RECORDING) {
      stopRecording()
    } else {
      startRecording()
    }
  }, [looperState, startRecording, stopRecording])

  const handlePlayStop = useCallback(() => {
    if (looperState === LooperState.PLAYING) {
      stopAll()
    } else {
      playAll()
    }
  }, [looperState, playAll, stopAll])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      switch (e.key.toLowerCase()) {
        case 'r':
          e.preventDefault()
          handleRecord()
          break
        case ' ':
          e.preventDefault()
          handlePlayStop()
          break
        case 'z':
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault()
            if (e.shiftKey) {
              redoTrack()
            } else {
              undoLastTrack()
            }
          }
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleRecord, handlePlayStop, undoLastTrack, redoTrack])

  const progressPosition = masterLoopLength > 0
    ? currentPosition / masterLoopLength
    : 0

  return (
    <div className="app">
      <header className="app-header">
        <h1>DAW Looper</h1>
        {error && <div className="error-banner">{error}</div>}
      </header>

      <TransportBar
        looperState={looperState}
        onRecord={handleRecord}
        onPlayStop={handlePlayStop}
        onUndo={undoLastTrack}
        onRedo={redoTrack}
        canUndo={tracks.length > 0}
        canRedo={false}
      />

      <LoopProgressBar
        currentPosition={progressPosition}
        isPlaying={looperState === LooperState.PLAYING}
      />

      <TrackList
        tracks={tracks}
        onToggleMute={toggleTrackMute}
        onSetVolume={setTrackVolume}
      />

      <div className="latency-adjust">
        <label>
          Sync offset: {latencyOffsetMs > 0 ? '→ ' : latencyOffsetMs < 0 ? '← ' : ''}{Math.abs(latencyOffsetMs)}ms
        </label>
        <input
          type="range"
          min="-500"
          max="500"
          step="5"
          value={latencyOffsetMs}
          onChange={(e) => setLatencyOffset(Number(e.target.value))}
        />
      </div>

      <div className="keyboard-hints">
        <span><kbd>R</kbd> Record</span>
        <span><kbd>Space</kbd> Play/Stop</span>
        <span><kbd>Ctrl+Z</kbd> Undo</span>
        <span><kbd>Ctrl+Shift+Z</kbd> Redo</span>
      </div>
    </div>
  )
}

export default App
