import { useEffect, useCallback } from 'react'
import { useDawStore } from '../store/useDawStore'
import { DawTransportBar } from './DawTransportBar'
import { DawTimeline } from './DawTimeline'
import { RotaryKnob } from './RotaryKnob'

export function DawView() {
  const playbackState = useDawStore(s => s.playbackState)
  const clips = useDawStore(s => s.clips)
  const currentPosition = useDawStore(s => s.currentPosition)
  const timelineLength = useDawStore(s => s.timelineLength)
  const masterVolume = useDawStore(s => s.masterVolume)
  const error = useDawStore(s => s.error)

  const initializeEngine = useDawStore(s => s.initializeEngine)
  const play = useDawStore(s => s.play)
  const stop = useDawStore(s => s.stop)
  const seekTo = useDawStore(s => s.seekTo)
  const startRecording = useDawStore(s => s.startRecording)
  const stopRecording = useDawStore(s => s.stopRecording)
  const moveClip = useDawStore(s => s.moveClip)
  const deleteClip = useDawStore(s => s.deleteClip)
  const setMasterVolume = useDawStore(s => s.setMasterVolume)
  const dispose = useDawStore(s => s.dispose)

  useEffect(() => {
    initializeEngine()
    return () => dispose()
  }, [initializeEngine, dispose])

  const handleRecord = useCallback(() => {
    if (playbackState === 'recording') {
      stopRecording()
    } else {
      startRecording()
    }
  }, [playbackState, startRecording, stopRecording])

  const handlePlay = useCallback(() => {
    if (playbackState === 'playing') {
      stop()
    } else {
      play()
    }
  }, [playbackState, play, stop])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      switch (e.key.toLowerCase()) {
        case 'r': e.preventDefault(); handleRecord(); break
        case ' ': e.preventDefault(); handlePlay(); break
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleRecord, handlePlay])

  return (
    <div className="daw-view">
      {error && <div className="error-banner">{error}</div>}

      <DawTransportBar
        playbackState={playbackState}
        currentPosition={currentPosition}
        onRecord={handleRecord}
        onPlay={handlePlay}
        onStop={stop}
      />

      <DawTimeline
        clips={clips}
        playbackState={playbackState}
        currentPosition={currentPosition}
        timelineLength={timelineLength}
        onMoveClip={moveClip}
        onDeleteClip={deleteClip}
        onSeek={seekTo}
      />

      <div className="bottom-controls">
        <RotaryKnob
          value={masterVolume}
          onChange={setMasterVolume}
          label="MASTER"
          size={56}
        />
      </div>
    </div>
  )
}
