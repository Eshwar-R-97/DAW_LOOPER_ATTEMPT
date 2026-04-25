import type { TrackSnapshot } from '../types'
import { TrackRow } from './TrackRow'
import { EmptyState } from './EmptyState'

interface TrackListProps {
  tracks: TrackSnapshot[]
  onToggleMute: (trackId: string) => void
  onSetVolume: (trackId: string, volume: number) => void
  onDeleteTrack: (trackId: string) => void
  onSetTrackReverb: (trackId: string, amount: number) => void
  onSetTrackPitch: (trackId: string, octaves: number) => void
}

export function TrackList({ tracks, onToggleMute, onSetVolume, onDeleteTrack, onSetTrackReverb, onSetTrackPitch }: TrackListProps) {
  const visibleTracks = tracks.filter((t) => !t.isDeleted)

  if (visibleTracks.length === 0) {
    return <EmptyState />
  }

  const sorted = [...visibleTracks].sort((a, b) => a.index - b.index)

  return (
    <div className="track-list">
      {sorted.map((track) => (
        <TrackRow
          key={track.id}
          track={track}
          onToggleMute={() => onToggleMute(track.id)}
          onSetVolume={(volume) => onSetVolume(track.id, volume)}
          onDelete={() => onDeleteTrack(track.id)}
          onSetReverb={(amount) => onSetTrackReverb(track.id, amount)}
          onSetPitch={(octaves) => onSetTrackPitch(track.id, octaves)}
        />
      ))}
    </div>
  )
}
