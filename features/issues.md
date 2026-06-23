# Known Issues

---

## Issue 1: Overdub Does Not Save the Final Loop Pass

### Status: Fixed (real-time overwriting buffer)

### Description

When recording an overdub (any track after Track 1), the user expects that the **last thing they performed** before pressing "Stop Recording" is what gets saved as the new track. Instead, the system saves audio from an earlier loop pass — often the first pass that had notable sound, or the 3rd pass, but **not the final one**.

**Steps to reproduce:**
1. Record Track 1 (sets master loop length).
2. Press Record to start overdubbing.
3. Let the loop cycle several times while performing. Perform something different on each pass so you can distinguish them.
4. On the final pass, perform a distinct sound.
5. Press Stop Recording.
6. Expected: The new track contains the audio from that final pass.
7. Actual: The new track contains audio from an earlier pass.

### Root Cause

The current overdub logic in `LoopEngine.stopRecording()` (lines ~155-210) works like this:

1. The entire recording session is captured as one long contiguous buffer by `AudioRecorder`.
2. After the user presses stop, the code tries to **retroactively extract the last complete loop** from that long buffer using boundary math (`firstBoundary`, `completeLoops`, slice offsets).
3. This extraction logic is fragile and error-prone:
   - The `firstBoundary` recalculation (setting it to 0 when `buffer.length > firstBoundary`) changes the alignment math in ways that may not correctly identify the "last" loop.
   - The boundary math depends on `recordStartPosition` being perfectly accurate, but recording latency (mic input delay, AudioWorklet message passing) means there's always some drift between when the engine *thinks* recording started and when audio samples actually arrived.
   - The `completeLoops` count and `lastLoopStart` offset can easily land on the wrong loop pass due to these accumulated timing errors.
4. The fundamental problem: **trying to slice the correct loop out of a giant buffer after the fact is inherently unreliable** when there's any timing imprecision.

### Fix Plan: Real-Time Overwriting Buffer

Instead of recording everything into one long buffer and slicing after the fact, **maintain a loop-length buffer that gets continuously overwritten in real time** as the recording happens.

#### How it works:

1. **On overdub start** (`startRecording()` when tracks already exist):
   - Create a new `Float32Array` of exactly `masterLoopLength` samples, initialized to zeros. Call this the **overdub buffer**.

2. **While recording** (as audio samples arrive from the mic):
   - Look at the current playhead position in the master loop.
   - Write each incoming sample into the overdub buffer at that playhead index.
   - As the loop cycles, the playhead wraps back to 0 and the new samples **overwrite** the previous pass's samples at those positions.
   - This means at any point in time, the overdub buffer contains the **most recent audio** for every position in the loop.

3. **On stop recording** (`stopRecording()`):
   - The overdub buffer already contains exactly one loop's worth of audio — the latest performance at every position.
   - No boundary math, no slicing, no guessing which loop pass was "last".
   - Simply use this buffer as the new track's audio data.
   - Apply the latency offset shift if needed, then create the track.

#### Why this is better:

- **No post-hoc slicing** — eliminates the fragile boundary/alignment math entirely.
- **Always saves the latest audio** — by definition, since older passes get overwritten.
- **Simpler code** — the overdub buffer is just `masterLoopLength` samples, always aligned to position 0.
- **Latency-tolerant** — even if there's slight drift in when samples arrive, they're written to the correct position based on the actual playhead, not calculated after the fact.

#### Implementation outline:

1. Add an `overdubBuffer: Float32Array | null` field to `LoopEngine`.
2. In `startRecording()`, when `this.tracks.length > 0`, allocate the buffer: `this.overdubBuffer = new Float32Array(this.masterLoopLength)`.
3. Modify `AudioRecorder` (or add a callback) so that incoming audio samples are written to `overdubBuffer[playheadPosition]` in real time, rather than just appended to a growing array.
4. In `stopRecording()`, for overdub tracks, use `this.overdubBuffer` directly instead of the old slicing logic.
5. Apply the latency offset shift to the overdub buffer if `_latencyOffsetMs !== 0`.
6. Create the new `AudioTrack` from the overdub buffer.
7. Set `this.overdubBuffer = null` after use.

#### Files to modify:

| File | Change |
|------|--------|
| `src/engine/LoopEngine.ts` | Add `overdubBuffer` field, allocate on overdub start, use on stop, remove old slicing logic |
| `src/engine/AudioRecorder.ts` | May need to expose a way to write samples to an external buffer in real time (callback or direct reference), OR LoopEngine handles this in `processAudioOutput` |

---

## Issue 2: Latency / Audio Desync on Overdub Tracks

### Status: Fixed (auto compensation + manual fine-tune)

### Description

Overdubbed tracks are audibly out of sync with the original track(s). When the user records a layer while listening to existing tracks, the new track plays back slightly late (or early) relative to what was heard during recording. This makes it impossible to build a tight, rhythmically accurate loop arrangement — the core use case of the app.

**Steps to reproduce:**
1. Record Track 1 with a clear rhythmic pattern (e.g., a beatbox drum loop).
2. Press Record to overdub Track 2, performing in sync with what you hear from Track 1.
3. Press Stop Recording.
4. Listen to both tracks playing back together.
5. Expected: Track 2 is perfectly in sync with Track 1, matching what the user heard while performing.
6. Actual: Track 2 is noticeably offset — the timing feels "late" or "sloppy" even though the user performed in time.

### Root Cause

Multiple sources of latency compound to create the desync:

1. **Output latency** — There's a delay between when the engine writes samples to the `ScriptProcessorNode` output buffer and when the user hears them through speakers/headphones. The engine's playhead is "ahead" of what the user actually hears.
2. **Input latency** — There's a delay between when the user makes a sound and when the mic samples arrive in the `AudioRecorder` (via AudioWorklet message passing or ScriptProcessor callback). The recorded samples arrive "late" relative to when they were performed.
3. **Round-trip offset** — The combination of output + input latency means the recorded audio is shifted in time relative to the playhead position. The user performed in sync with what they *heard*, but the engine recorded it relative to where the playhead *was* — which is ahead of what the user heard.
4. **Existing offset mechanism is manual** — There's a `_latencyOffsetMs` property and a UI slider for the user to manually compensate, but this requires trial and error and doesn't automatically detect or correct for the actual system latency.

### Fix Plan

**Implemented:**
- `estimateRoundTripLatencyMs()` uses `AudioContext.baseLatency`, `outputLatency`, output buffer size (2048), and input capture quantum (128 worklet / 4096 ScriptProcessor fallback).
- Measured automatically on engine `initialize()`; applied during real-time overdub writes (shifts placement earlier in the loop).
- Manual fine-tune slider (-500…500ms) stacks on top of auto compensation.

---

## Issue 3: Audio Clipping / Quality Degradation

### Status: Fixed (raw mic + soft limiting + input meter)

### Description

Recorded audio quality is noticeably poor. Certain sounds are unpredictably clipped, cut off, muted, or dampened in the recorded track. This makes the app feel unreliable — you perform something and what comes back sounds different or incomplete. The issue is most noticeable with:
- Percussive/transient sounds (beatbox kicks, snares, hi-hats) where sharp attacks get softened or lost
- Louder passages where peaks seem to be clipped or distorted
- Sections where audio seems to briefly drop out or go silent mid-recording

**Steps to reproduce:**
1. Record any track with dynamic audio (loud and quiet parts, sharp transients).
2. Listen to the playback.
3. Expected: Faithful reproduction of what was performed.
4. Actual: Some sounds are clipped, dampened, or missing entirely. Quality feels degraded compared to the original performance.

### Possible Causes

This issue may stem from multiple overlapping factors, and it's unclear which is the primary culprit:

1. **Latency-related data loss** — If the latency desync (Issue 2) is severe enough, the post-hoc buffer slicing or alignment shifting could be cutting into actual audio data, effectively erasing parts of the performance. Shifting samples by an offset means samples at the boundaries get lost or wrapped incorrectly.

2. **Buffer overwriting during alignment** — The current overdub extraction logic (Issue 1) slices and repositions audio. If the slice boundaries land in the middle of a transient, that transient gets split across two loop passes and partially discarded.

3. **Chrome/browser audio processing** — Chrome may apply automatic gain control (AGC), noise suppression, or echo cancellation to the microphone input via `getUserMedia`. These processing steps can dampen transients, compress dynamics, and create the "muted" quality. The current `getUserMedia` call uses `{ audio: true }` without disabling these.

4. **ScriptProcessorNode / AudioWorklet buffer gaps** — If the main thread is busy (React re-renders, state updates) and the ScriptProcessor callback fires late, audio samples could be dropped. The AudioWorklet path is better but message passing to the main thread still has potential for gaps.

5. **Clipping in the mixer** — The `AudioMixer` clamps output to [-1, 1]. If multiple tracks sum to values beyond this range, the output hard-clips. This is normal mixing behavior but could sound harsh. Additionally, per-track volume uses a squared gain curve (`volume^2`), which may interact with loud signals unexpectedly.

6. **Microphone hardware/settings** — The user's mic may have its own AGC or low-quality ADC. This is less likely to be the primary cause but could compound other issues.

### Fix Plan

**Implemented (Issues 1 & 2 also removed slicing/alignment data loss):**
- Raw `getUserMedia` constraints — AGC, noise suppression, and echo cancellation disabled (`micConstraints.ts`).
- Capture graph uses zero-gain output instead of routing mic to speakers (prevents feedback / double monitoring on ScriptProcessor fallback).
- Persistent mic analyser for live **INPUT** level meter with “hot” warning above 95%.
- Playback mixer uses `softLimit()` (tanh above ±1) instead of hard clamp to reduce harsh clipping when layers sum loud.

---

## Issue 4: Recorded Layer Volume Doesn't Match Heard Backing

### Status: Fixed (mix-aware level matching)

### Description

When overdubbing, a new layer often sounded much louder or quieter than it did relative to the backing tracks while recording. The user performed to match what they heard in the mix, but playback did not reflect that balance.

### Root Cause

- Existing tracks play through **volume²** perceptual gain and **master volume**.
- New overdubs were always stored at **raw mic level** with the volume knob at **1.0** (gain = 1).
- Example: Track 1 at 50% knob → heard at 25% gain. User performs to match. New track saved at full mic level → plays 4× louder in the mix.

### Fix

- **First track:** `normalizeRecordingPeak()` scales hot recordings to ~0.85 peak for headroom.
- **Overdubs:** After capture, `overdubVolumeForMixBalance()` sets the new track's volume so its peak output matches the monitored backing mix (`trackLeveling.ts`).

---
