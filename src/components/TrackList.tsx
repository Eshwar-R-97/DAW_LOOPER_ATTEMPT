import type { TrackSnapshot } from '../types'
import { TrackRow } from './TrackRow'
import { EmptyState } from './EmptyState'

interface TrackListProps {
  tracks: TrackSnapshot[]
  onToggleMute: (trackId: string) => void
  onSetVolume: (trackId: string, volume: number) => void
}

export function TrackList({ tracks, onToggleMute, onSetVolume }: TrackListProps) {
  if (tracks.length === 0) {
    return <EmptyState />
  }

  const sorted = [...tracks].sort((a, b) => a.index - b.index)

  return (
    <div className="track-list">
      {sorted.map((track) => (
        <TrackRow
          key={track.id}
          track={track}
          onToggleMute={() => onToggleMute(track.id)}
          onSetVolume={(volume) => onSetVolume(track.id, volume)}
        />
      ))}
    </div>
  )
}
