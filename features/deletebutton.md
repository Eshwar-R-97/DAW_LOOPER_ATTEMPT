# Delete Button Feature

## Overview

Add a delete button (X) to the top-right corner of each track row. Deleting a track hides it from the UI but preserves it in the backend with volume set to 0, so it can be recovered later via a future undo/history system.

---

## Design Decision: Soft Delete

Instead of physically removing the track from the engine's track array:
- Set the track's volume to 0 and mark it as "deleted"
- Filter deleted tracks out of the UI
- The track remains in memory and in the engine's track list
- Future Ctrl+Z / undo system can restore deleted tracks by un-marking them and restoring their volume

This approach keeps the audio engine simple (no gaps in track indices, no reordering) and makes undo trivial.

---

## Implementation Steps

### Step 1: Backend — Add deleted flag to track state

- **File:** `src/types.ts`
  - Add `isDeleted: boolean` to `TrackSnapshot`
- **File:** `src/engine/AudioTrack.ts`
  - Add `_isDeleted: boolean` field (default `false`)
  - Add `_savedVolume: number` field to remember pre-delete volume
  - Add `softDelete()` method: saves current volume, sets volume to 0, sets `_isDeleted = true`
  - Add `restore()` method: restores saved volume, sets `_isDeleted = false`
  - Include `isDeleted` in `toSnapshot()`
- **File:** `src/engine/LoopEngine.ts`
  - Add `deleteTrack(trackId: string)` method: calls `track.softDelete()`
  - Add `restoreTrack(trackId: string)` method (for future use): calls `track.restore()`

### Step 2: Store — Expose delete action

- **File:** `src/store/useLooperStore.ts`
  - Add `deleteTrack: (trackId: string) => void` action
  - Calls `engine.deleteTrack(trackId)`

### Step 3: UI — Delete button on TrackRow

- **File:** `src/components/TrackRow.tsx`
  - Add `onDelete: () => void` prop
  - Render an X button positioned at the top-right of the track row
  - Style: small, subtle, visible on hover, becomes prominent on hover
- **File:** `src/components/TrackList.tsx`
  - Filter out tracks where `isDeleted === true` before rendering
  - Pass `onDelete` callback to each TrackRow

### Step 4: CSS

- **File:** `src/index.css`
  - `.delete-button`: positioned absolute top-right of `.track-row`
  - Subtle by default (low opacity), full opacity on track row hover
  - Small X icon, no background, red color on hover

### Step 5: Test

- Update `TrackRow.test.tsx` to verify delete button renders and fires callback
- Update `AudioTrack.test.ts` to verify soft delete/restore preserves volume
- Run `npm test` and `npm run build`

---

## Files Modified

| File | Action |
|------|--------|
| `src/types.ts` | Add `isDeleted` to TrackSnapshot |
| `src/engine/AudioTrack.ts` | Add soft delete/restore methods |
| `src/engine/LoopEngine.ts` | Add `deleteTrack()` method |
| `src/store/useLooperStore.ts` | Expose `deleteTrack` action |
| `src/components/TrackRow.tsx` | Add X delete button |
| `src/components/TrackList.tsx` | Filter deleted tracks |
| `src/index.css` | Delete button styles |
| Tests | Update for new functionality |
