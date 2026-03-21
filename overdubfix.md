# Overdub Alignment Fix

## Problem

When recording multiple loops during overdub, the `firstBoundary` calculation is fixed at the moment the record button is pressed and never updates. This causes audio loss when a user records more than one complete loop cycle.

**Scenario:**
- masterLoopLength = 44100
- User presses record at playhead position 43000
- firstBoundary = 44100 - 43000 = 1100 (calculated once, never changes)
- User records 88200 samples (2 complete loops, intending to do multiple takes)
- Expected: Second loop should align to position 0 (fresh start for retake)
- Actual: System still uses firstBoundary = 1100, causing misalignment and audio loss

## Root Cause

In `src/engine/LoopEngine.ts` (lines 151-176), the `stopRecording()` method calculates `firstBoundary` once based on `recordStartPosition` and uses it for the entire recording, regardless of how many loops were captured.

## Solution

Redefine `firstBoundary` to 0 once the recorded buffer length exceeds the initial firstBoundary. This allows subsequent loops to be treated as fresh recordings starting from position 0.

**Implementation:**

1. Calculate the original `firstBoundary` as currently done:
   ```typescript
   const firstBoundary = loopLen - this.recordStartPosition
   ```

2. Check if buffer extends beyond the first boundary:
   ```typescript
   if (buffer.length > firstBoundary) {
     // User recorded multiple loops; redefine firstBoundary for alignment
     firstBoundary = 0
   }
   ```

3. Use the updated `firstBoundary` in the existing alignment logic:
   - For multiple complete loops: extract using the new boundary (which is now 0)
   - For single loop or partial: placement logic remains the same

This ensures:
- Single-loop recordings: aligned to original `recordStartPosition` offset (unchanged behavior)
- Multi-loop recordings: later loops aligned to position 0 (fixed behavior for multi-take overdubbing)

## Files to Modify

- `src/engine/LoopEngine.ts` - `stopRecording()` method, lines 151-176
