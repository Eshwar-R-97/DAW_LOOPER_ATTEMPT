# DAW Looper - Project Plan

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| UI Framework | React 18 + TypeScript | Component-based UI with type safety |
| Build Tool | Vite | Fast dev server, HMR, TypeScript support |
| Test Framework | Vitest + React Testing Library | Unit/integration tests, DOM testing |
| Audio | Web Audio API + AudioWorklet | Low-latency recording, playback, mixing |
| State | Zustand | Lightweight state management bridging engine ↔ UI |
| Styling | CSS Modules | Scoped styles, dark theme, no extra dependencies |
| Waveform | Custom Canvas rendering | Real-time waveform visualization per track |

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   UI Layer (React)                   │
│  App → TransportBar → TrackList → TrackRow → ...    │
│                                                     │
│  Reads from Zustand store, dispatches commands       │
└──────────────────────┬──────────────────────────────┘
                       │ subscribe / dispatch
┌──────────────────────┴──────────────────────────────┐
│              State Layer (Zustand Store)              │
│                                                      │
│  useLooperStore: tracks[], loopState, masterLength   │
│  Actions: startRecording, stopRecording, toggleMute  │
│  Listens to engine events, calls engine methods      │
└──────────────────────┬──────────────────────────────┘
                       │ method calls / event callbacks
┌──────────────────────┴──────────────────────────────┐
│              Audio Engine (Pure TypeScript)           │
│                                                      │
│  LoopEngine ─── orchestrates everything              │
│    ├── AudioRecorder ─── mic input capture            │
│    ├── AudioTrack[] ─── individual track buffers      │
│    └── AudioMixer ─── combines tracks for output      │
│                                                      │
│  No DOM, no React — fully testable in isolation      │
└─────────────────────────────────────────────────────┘
```

The Audio Engine has **zero dependencies on the browser DOM or React**. It depends only on the Web Audio API interfaces, which we mock in tests. This means all core logic (loop timing, track management, recording, mixing) is testable with pure unit tests.

---

## Core Types & Interfaces

These are the shared types used across all layers.

### Enums

```typescript
// src/types.ts

/** The current state of the overall looper */
enum LooperState {
  EMPTY = 'empty',           // No tracks recorded yet
  RECORDING = 'recording',   // Currently recording a track
  PLAYING = 'playing',       // All tracks looping
  STOPPED = 'stopped',       // Tracks exist but playback is stopped
}

/** The state of an individual track */
enum TrackState {
  RECORDING = 'recording',   // Currently being recorded
  PLAYING = 'playing',       // Looping in playback
  MUTED = 'muted',           // Exists but silenced (stays in sync)
  STOPPED = 'stopped',       // Silenced and position reset
}
```

### Interfaces

```typescript
// src/types.ts

/** Represents a single audio track in the looper */
interface Track {
  id: string;                    // Unique identifier
  index: number;                 // Display order (0-based, 0 = first/master track)
  state: TrackState;             // Current track state
  audioBuffer: Float32Array[];   // Raw audio data (array of channels)
  duration: number;              // Length in seconds
  volume: number;                // 0.0 to 1.0
  isMuted: boolean;              // Mute state
  waveformData: number[];        // Downsampled peaks for waveform display
}

/** Configuration for the audio engine */
interface AudioEngineConfig {
  sampleRate: number;            // e.g., 44100 or 48000
  channelCount: number;          // 1 (mono) or 2 (stereo)
  inputDeviceId?: string;        // Specific mic to use (optional)
}

/** Snapshot of engine state emitted to the store */
interface EngineStateSnapshot {
  looperState: LooperState;
  tracks: TrackSnapshot[];
  masterLoopLength: number;      // In seconds, 0 if no tracks
  currentPosition: number;       // Playhead position in seconds
}

/** Lightweight track info for the store (no raw audio buffer) */
interface TrackSnapshot {
  id: string;
  index: number;
  state: TrackState;
  duration: number;
  volume: number;
  isMuted: boolean;
  waveformData: number[];
}

/** Events emitted by the engine to notify the store of changes */
type EngineEvent =
  | { type: 'stateChange'; snapshot: EngineStateSnapshot }
  | { type: 'positionUpdate'; position: number }
  | { type: 'trackAdded'; track: TrackSnapshot }
  | { type: 'trackRemoved'; trackId: string }
  | { type: 'error'; message: string };
```

### Tests for Types (Phase 0)

```
src/types.test.ts
  ✓ LooperState enum has all expected values
  ✓ TrackState enum has all expected values
  ✓ A Track object can be created with all required fields
  ✓ Default volume is 1.0 and isMuted is false for new tracks
```

---

## Audio Engine Layer

The engine is the core of the application. It handles all audio logic with no UI dependencies.

### Class: `AudioRecorder`

**Purpose**: Manages microphone access and captures raw audio data.

**File**: `src/engine/AudioRecorder.ts`

```typescript
class AudioRecorder {
  // Properties
  private mediaStream: MediaStream | null;
  private audioContext: AudioContext;
  private analyserNode: AnalyserNode;
  private isRecording: boolean;
  private recordedChunks: Float32Array[];

  // Constructor
  constructor(audioContext: AudioContext);

  // Methods
  async requestMicAccess(): Promise<void>;
    // Requests microphone permission via navigator.mediaDevices.getUserMedia
    // Stores the MediaStream for later use
    // Throws if permission denied

  startCapture(): void;
    // Connects MediaStream to AudioContext via MediaStreamSourceNode
    // Connects to a ScriptProcessorNode or AudioWorkletNode to capture samples
    // Begins pushing Float32Array chunks to recordedChunks[]
    // Throws if no mic access

  stopCapture(): Float32Array;
    // Stops capturing audio
    // Concatenates all recordedChunks into a single Float32Array
    // Returns the complete recorded buffer
    // Resets recordedChunks for next recording

  getAnalyserNode(): AnalyserNode;
    // Returns the analyser for real-time waveform/level monitoring

  dispose(): void;
    // Stops all streams, disconnects nodes, releases mic
}
```

**Tests**: `src/engine/AudioRecorder.test.ts`

```
AudioRecorder
  Constructor
    ✓ creates an instance with an AudioContext
    ✓ initializes with isRecording = false

  requestMicAccess()
    ✓ calls navigator.mediaDevices.getUserMedia with audio: true
    ✓ stores the returned MediaStream
    ✓ throws an error if mic permission is denied

  startCapture()
    ✓ throws if requestMicAccess was not called first
    ✓ sets isRecording to true
    ✓ begins accumulating audio chunks

  stopCapture()
    ✓ sets isRecording to false
    ✓ returns a concatenated Float32Array of all recorded chunks
    ✓ returns an empty Float32Array if no audio was captured
    ✓ resets internal chunks array after stopping

  dispose()
    ✓ stops all MediaStream tracks
    ✓ disconnects audio nodes
    ✓ can be called safely even if never started
```

---

### Class: `AudioTrack`

**Purpose**: Represents a single recorded loop track with its audio data and controls.

**File**: `src/engine/AudioTrack.ts`

```typescript
class AudioTrack {
  // Properties
  readonly id: string;
  readonly index: number;
  private buffer: Float32Array;
  private _state: TrackState;
  private _volume: number;          // 0.0 to 1.0
  private _isMuted: boolean;
  private _waveformData: number[];

  // Constructor
  constructor(id: string, index: number, buffer: Float32Array, sampleRate: number);

  // Getters
  get state(): TrackState;
  get volume(): number;
  get isMuted(): boolean;
  get duration(): number;
  get waveformData(): number[];
  get sampleCount(): number;

  // Methods
  setVolume(value: number): void;
    // Clamps value to 0.0–1.0 range
    // Updates internal _volume

  toggleMute(): void;
    // Toggles _isMuted
    // If muting: sets state to MUTED
    // If unmuting: sets state to PLAYING

  play(): void;
    // Sets state to PLAYING

  stop(): void;
    // Sets state to STOPPED

  getSample(position: number): number;
    // Returns the audio sample at the given position (index into buffer)
    // Applies volume scaling
    // Returns 0 if muted
    // Wraps around if position > buffer length (for looping)

  getSampleBatch(startPosition: number, length: number): Float32Array;
    // Returns a batch of samples starting at position, with volume applied
    // Handles wrap-around for looping
    // Returns zeros if muted

  toSnapshot(): TrackSnapshot;
    // Returns a lightweight snapshot (no raw buffer) for the store

  static generateWaveformData(buffer: Float32Array, numPoints: number): number[];
    // Downsamples the audio buffer into numPoints peak values
    // Used for waveform visualization
}
```

**Tests**: `src/engine/AudioTrack.test.ts`

```
AudioTrack
  Constructor
    ✓ creates a track with the given id and index
    ✓ initializes with state PLAYING
    ✓ initializes with volume 1.0
    ✓ initializes with isMuted false
    ✓ calculates duration from buffer length and sample rate
    ✓ generates waveform data on construction

  setVolume()
    ✓ sets volume to the given value
    ✓ clamps volume to 0.0 minimum
    ✓ clamps volume to 1.0 maximum
    ✓ accepts decimal values like 0.5

  toggleMute()
    ✓ sets isMuted to true and state to MUTED when unmuted
    ✓ sets isMuted to false and state to PLAYING when muted

  play()
    ✓ sets state to PLAYING
    ✓ does nothing if already PLAYING

  stop()
    ✓ sets state to STOPPED

  getSample()
    ✓ returns the sample at the given position scaled by volume
    ✓ returns 0 when track is muted
    ✓ wraps around when position exceeds buffer length
    ✓ returns 0 for negative position

  getSampleBatch()
    ✓ returns correct number of samples
    ✓ applies volume scaling to all samples
    ✓ returns all zeros when muted
    ✓ wraps around at buffer boundary

  toSnapshot()
    ✓ returns object with all track metadata
    ✓ does not include raw audio buffer

  generateWaveformData()
    ✓ returns the correct number of data points
    ✓ peak values are between 0 and 1
    ✓ handles empty buffer
    ✓ handles buffer shorter than numPoints
```

---

### Class: `AudioMixer`

**Purpose**: Combines audio from multiple tracks into a single output buffer for playback.

**File**: `src/engine/AudioMixer.ts`

```typescript
class AudioMixer {
  // Properties
  private masterVolume: number;

  // Constructor
  constructor(masterVolume?: number);  // defaults to 1.0

  // Methods
  setMasterVolume(value: number): void;
    // Clamps to 0.0–1.0

  getMasterVolume(): number;

  mixTracks(tracks: AudioTrack[], position: number, bufferLength: number): Float32Array;
    // For each sample in the output buffer:
    //   Sum the samples from all non-muted tracks at (position + i),
    //   each scaled by their individual volume
    // Scale the sum by masterVolume
    // Clamp final values to -1.0 to 1.0 to prevent clipping
    // Returns the mixed output buffer

  mixSample(tracks: AudioTrack[], position: number): number;
    // Mix a single sample from all tracks at the given position
    // Returns the mixed and clamped value
}
```

**Tests**: `src/engine/AudioMixer.test.ts`

```
AudioMixer
  Constructor
    ✓ defaults to master volume 1.0
    ✓ accepts a custom master volume

  setMasterVolume()
    ✓ updates the master volume
    ✓ clamps to 0.0–1.0 range

  mixSample()
    ✓ returns 0 when no tracks provided
    ✓ returns the single track's sample when only one track
    ✓ sums samples from multiple tracks
    ✓ applies master volume scaling
    ✓ skips muted tracks
    ✓ clamps output to -1.0 to 1.0

  mixTracks()
    ✓ returns a Float32Array of the correct length
    ✓ mixes all tracks for each sample position
    ✓ handles wrap-around per track (different length tracks)
    ✓ returns silence (zeros) when all tracks are muted
    ✓ applies master volume to the entire output
    ✓ clamps all values to prevent clipping
```

---

### Class: `LoopEngine`

**Purpose**: The main orchestrator. Manages the record → overdub → play lifecycle, coordinates all tracks, drives the audio output.

**File**: `src/engine/LoopEngine.ts`

```typescript
class LoopEngine {
  // Properties
  private audioContext: AudioContext;
  private recorder: AudioRecorder;
  private mixer: AudioMixer;
  private tracks: AudioTrack[];
  private _state: LooperState;
  private masterLoopLength: number;   // In samples
  private playheadPosition: number;   // Current position in samples
  private outputNode: AudioWorkletNode | ScriptProcessorNode;
  private onEvent: (event: EngineEvent) => void;

  // Constructor
  constructor(config: AudioEngineConfig, onEvent: (event: EngineEvent) => void);

  // Getters
  get state(): LooperState;
  get trackCount(): number;
  get masterDuration(): number;       // masterLoopLength in seconds
  get currentPosition(): number;      // playheadPosition in seconds
  get allTracks(): TrackSnapshot[];

  // Lifecycle Methods
  async initialize(): Promise<void>;
    // Creates AudioContext
    // Sets up AudioWorklet or ScriptProcessor for output
    // Requests mic access via AudioRecorder
    // Sets state to EMPTY

  // Recording Methods
  startRecording(): void;
    // If EMPTY state:
    //   Start capturing mic audio
    //   Set state to RECORDING
    // If PLAYING state:
    //   Start capturing mic audio (overdub - recording a new track)
    //   Keep existing tracks playing
    //   Set state to RECORDING
    // Emit stateChange event

  stopRecording(): AudioTrack;
    // Stop mic capture, get the recorded buffer
    // If this is the FIRST track (tracks.length === 0):
    //   Set masterLoopLength to the recorded buffer length
    // If this is a subsequent track:
    //   Trim or pad the buffer to match masterLoopLength
    // Create a new AudioTrack from the buffer
    // Add it to tracks[]
    // Set state to PLAYING
    // Start/resume playback of all tracks
    // Emit trackAdded + stateChange events
    // Return the new track

  // Playback Methods
  playAll(): void;
    // Resume playback of all non-stopped tracks
    // Set state to PLAYING
    // Emit stateChange event

  stopAll(): void;
    // Pause playback, reset playhead to 0
    // Set state to STOPPED
    // Emit stateChange event

  // Track Control Methods
  toggleTrackMute(trackId: string): void;
    // Find track by ID
    // Call track.toggleMute()
    // Emit stateChange event

  setTrackVolume(trackId: string, volume: number): void;
    // Find track by ID
    // Call track.setVolume(volume)
    // Emit stateChange event

  setMasterVolume(volume: number): void;
    // Update mixer master volume
    // Emit stateChange event

  // Undo/Redo Methods
  undoLastTrack(): AudioTrack | null;
    // Remove the most recently added track
    // If it was the only track, reset masterLoopLength and set state to EMPTY
    // Store removed track for redo
    // Emit trackRemoved + stateChange events
    // Return removed track or null if no tracks

  redoTrack(): AudioTrack | null;
    // Re-add the most recently undone track
    // Emit trackAdded + stateChange events
    // Return re-added track or null if nothing to redo

  // Internal Methods (private)
  private processAudioOutput(outputBuffer: Float32Array): void;
    // Called by AudioWorklet/ScriptProcessor each audio frame
    // Uses mixer.mixTracks() to fill the output buffer
    // Advances playheadPosition, wrapping at masterLoopLength
    // Emits positionUpdate event periodically (throttled)

  private getTrackById(trackId: string): AudioTrack;
    // Find and return track, throw if not found

  private emitSnapshot(): void;
    // Build EngineStateSnapshot from current state
    // Call onEvent with stateChange event

  // Cleanup
  dispose(): void;
    // Stop all playback
    // Dispose recorder
    // Close AudioContext
    // Clear tracks
}
```

**Tests**: `src/engine/LoopEngine.test.ts`

```
LoopEngine
  Constructor & Initialization
    ✓ creates engine in EMPTY state
    ✓ initialize() requests mic access
    ✓ initialize() sets up audio context with correct sample rate
    ✓ emits stateChange event after initialization

  First Track Recording (Master Loop)
    ✓ startRecording() transitions from EMPTY to RECORDING
    ✓ startRecording() begins mic capture
    ✓ stopRecording() transitions from RECORDING to PLAYING
    ✓ stopRecording() creates an AudioTrack from recorded buffer
    ✓ stopRecording() sets masterLoopLength to first track's length
    ✓ stopRecording() adds track to tracks array
    ✓ stopRecording() emits trackAdded event
    ✓ stopRecording() emits stateChange event
    ✓ first track has index 0

  Subsequent Track Recording (Overdub)
    ✓ startRecording() while PLAYING transitions to RECORDING
    ✓ existing tracks continue playing during recording
    ✓ stopRecording() trims buffer to masterLoopLength if longer
    ✓ stopRecording() pads buffer with silence if shorter than masterLoopLength
    ✓ new track gets incrementing index
    ✓ new track is added to tracks array alongside existing tracks
    ✓ all tracks play after stopRecording()

  Playback
    ✓ playAll() transitions from STOPPED to PLAYING
    ✓ playAll() does nothing if already PLAYING
    ✓ stopAll() transitions from PLAYING to STOPPED
    ✓ stopAll() resets playhead to 0
    ✓ emits positionUpdate events during playback

  Audio Processing
    ✓ processAudioOutput fills buffer with mixed track audio
    ✓ playhead wraps around at masterLoopLength
    ✓ playhead advances by buffer length each process call

  Track Controls
    ✓ toggleTrackMute() mutes an unmuted track
    ✓ toggleTrackMute() unmutes a muted track
    ✓ toggleTrackMute() throws for invalid track ID
    ✓ setTrackVolume() updates the track's volume
    ✓ setTrackVolume() clamps to valid range
    ✓ setMasterVolume() updates mixer volume

  Undo/Redo
    ✓ undoLastTrack() removes the most recent track
    ✓ undoLastTrack() returns the removed track
    ✓ undoLastTrack() resets to EMPTY if last track removed
    ✓ undoLastTrack() resets masterLoopLength if last track removed
    ✓ undoLastTrack() returns null if no tracks exist
    ✓ redoTrack() re-adds the most recently undone track
    ✓ redoTrack() returns null if nothing to redo
    ✓ recording a new track clears the redo stack

  Events
    ✓ emits stateChange on every state transition
    ✓ emits trackAdded when a track is created
    ✓ emits trackRemoved on undo
    ✓ emits error event when something goes wrong

  Dispose
    ✓ dispose() stops playback
    ✓ dispose() clears all tracks
    ✓ dispose() closes AudioContext
    ✓ dispose() disposes recorder
```

---

## State Management Layer

### Zustand Store: `useLooperStore`

**Purpose**: Bridges the Audio Engine to React. Holds the UI-facing state and exposes actions that delegate to the engine.

**File**: `src/store/useLooperStore.ts`

```typescript
interface LooperStore {
  // State (derived from engine snapshots)
  looperState: LooperState;
  tracks: TrackSnapshot[];
  masterLoopLength: number;
  currentPosition: number;
  masterVolume: number;
  error: string | null;

  // Engine reference
  engine: LoopEngine | null;

  // Actions
  initializeEngine: (config?: Partial<AudioEngineConfig>) => Promise<void>;
    // Creates LoopEngine with event handler that updates this store
    // Calls engine.initialize()

  startRecording: () => void;
    // Calls engine.startRecording()

  stopRecording: () => void;
    // Calls engine.stopRecording()

  playAll: () => void;
  stopAll: () => void;
  toggleTrackMute: (trackId: string) => void;
  setTrackVolume: (trackId: string, volume: number) => void;
  setMasterVolume: (volume: number) => void;
  undoLastTrack: () => void;
  redoTrack: () => void;
  dispose: () => void;
}
```

**Tests**: `src/store/useLooperStore.test.ts`

```
useLooperStore
  Initial State
    ✓ starts with looperState EMPTY
    ✓ starts with empty tracks array
    ✓ starts with masterLoopLength 0
    ✓ starts with currentPosition 0
    ✓ starts with masterVolume 1.0
    ✓ starts with engine null

  initializeEngine()
    ✓ creates a LoopEngine instance
    ✓ updates store on engine stateChange events
    ✓ updates currentPosition on positionUpdate events
    ✓ sets error on engine error events

  Action Delegation
    ✓ startRecording() calls engine.startRecording()
    ✓ stopRecording() calls engine.stopRecording()
    ✓ playAll() calls engine.playAll()
    ✓ stopAll() calls engine.stopAll()
    ✓ toggleTrackMute() calls engine with correct trackId
    ✓ setTrackVolume() calls engine with correct trackId and volume
    ✓ setMasterVolume() calls engine and updates local state
    ✓ undoLastTrack() calls engine.undoLastTrack()
    ✓ redoTrack() calls engine.redoTrack()

  State Sync
    ✓ tracks array updates when engine emits trackAdded
    ✓ tracks array updates when engine emits trackRemoved
    ✓ looperState updates on every engine stateChange

  Error Handling
    ✓ sets error when engine emits error event
    ✓ clears error when a successful action occurs

  Dispose
    ✓ dispose() calls engine.dispose()
    ✓ dispose() resets store to initial state
```

---

## UI Components Layer

### Component Tree

```
<App>
  └── <LooperApp>
       ├── <Header />                    // App title, master volume
       ├── <TransportBar />              // Record, Play/Stop, Undo, Redo buttons
       ├── <LoopProgressBar />           // Visual playhead position in the loop
       ├── <TrackList>                   // Container for all tracks
       │    ├── <TrackRow track={0} />   // Individual track display
       │    ├── <TrackRow track={1} />
       │    └── ...
       └── <EmptyState />               // Shown when no tracks recorded
```

### Component: `App`

**File**: `src/App.tsx`

```typescript
// Root component
// Calls initializeEngine() on mount
// Renders <LooperApp /> or loading/error state
```

**Tests**: `src/App.test.tsx`

```
App
  ✓ renders without crashing
  ✓ initializes the audio engine on mount
  ✓ shows loading state while engine initializes
  ✓ shows error state if engine fails to initialize
  ✓ renders LooperApp after successful initialization
```

---

### Component: `TransportBar`

**File**: `src/components/TransportBar.tsx`

```typescript
interface TransportBarProps {
  looperState: LooperState;
  onRecord: () => void;       // Start or stop recording
  onPlayStop: () => void;     // Toggle play/stop
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

// Renders:
//   [Record] button — red when recording, default otherwise
//   [Play/Stop] button — toggles based on state
//   [Undo] button — disabled when canUndo is false
//   [Redo] button — disabled when canRedo is false
//   Visual state indicator text (e.g., "Recording...", "Playing", "Stopped")
```

**Tests**: `src/components/TransportBar.test.tsx`

```
TransportBar
  Record Button
    ✓ renders a record button
    ✓ calls onRecord when clicked
    ✓ has 'recording' style when looperState is RECORDING
    ✓ shows "Record" text when not recording
    ✓ shows "Stop Recording" text when recording

  Play/Stop Button
    ✓ renders a play/stop button
    ✓ shows "Play" when stopped
    ✓ shows "Stop" when playing
    ✓ calls onPlayStop when clicked
    ✓ is disabled when looperState is EMPTY

  Undo/Redo
    ✓ renders undo button
    ✓ renders redo button
    ✓ undo is disabled when canUndo is false
    ✓ redo is disabled when canRedo is false
    ✓ calls onUndo when undo clicked
    ✓ calls onRedo when redo clicked

  State Indicator
    ✓ shows "Ready to record" when EMPTY
    ✓ shows "Recording..." when RECORDING
    ✓ shows "Playing" when PLAYING
    ✓ shows "Stopped" when STOPPED
```

---

### Component: `LoopProgressBar`

**File**: `src/components/LoopProgressBar.tsx`

```typescript
interface LoopProgressBarProps {
  currentPosition: number;    // 0.0 to 1.0 (fraction of loop completed)
  isPlaying: boolean;
}

// Renders:
//   A horizontal bar showing the current playhead position in the loop
//   Animates smoothly during playback
//   Resets to 0 when stopped
```

**Tests**: `src/components/LoopProgressBar.test.tsx`

```
LoopProgressBar
  ✓ renders a progress bar element
  ✓ sets width to 0% when position is 0
  ✓ sets width to 50% when position is 0.5
  ✓ sets width to 100% when position is 1.0
  ✓ has active styling when isPlaying is true
  ✓ has inactive styling when isPlaying is false
```

---

### Component: `TrackList`

**File**: `src/components/TrackList.tsx`

```typescript
interface TrackListProps {
  tracks: TrackSnapshot[];
  onToggleMute: (trackId: string) => void;
  onSetVolume: (trackId: string, volume: number) => void;
}

// Renders:
//   A vertical list of <TrackRow /> components
//   Shows <EmptyState /> when tracks is empty
```

**Tests**: `src/components/TrackList.test.tsx`

```
TrackList
  ✓ renders a TrackRow for each track
  ✓ renders EmptyState when tracks is empty
  ✓ passes correct props to each TrackRow
  ✓ renders tracks in order by index
```

---

### Component: `TrackRow`

**File**: `src/components/TrackRow.tsx`

```typescript
interface TrackRowProps {
  track: TrackSnapshot;
  onToggleMute: () => void;
  onSetVolume: (volume: number) => void;
}

// Renders:
//   Track label ("Track 1", "Track 2", etc.)
//   State indicator (colored dot: red=recording, green=playing, grey=muted)
//   <WaveformDisplay /> showing the track's waveform
//   Mute/Unmute toggle button
//   Volume slider (0–100)
```

**Tests**: `src/components/TrackRow.test.tsx`

```
TrackRow
  ✓ displays the track label with correct number
  ✓ shows recording indicator when state is RECORDING
  ✓ shows playing indicator when state is PLAYING
  ✓ shows muted indicator when state is MUTED
  ✓ renders a WaveformDisplay with the track's waveformData
  ✓ renders a mute toggle button
  ✓ calls onToggleMute when mute button clicked
  ✓ mute button shows "Mute" when playing and "Unmute" when muted
  ✓ renders a volume slider
  ✓ volume slider reflects current track volume
  ✓ calls onSetVolume when slider changes
```

---

### Component: `WaveformDisplay`

**File**: `src/components/WaveformDisplay.tsx`

```typescript
interface WaveformDisplayProps {
  waveformData: number[];     // Array of peak values (0–1)
  state: TrackState;          // For color coding
  currentPosition?: number;   // 0.0–1.0 for playhead overlay
}

// Renders:
//   A <canvas> element drawing vertical bars for each waveform data point
//   Color-coded by track state (green=playing, red=recording, grey=muted)
//   Optional vertical playhead line at currentPosition
```

**Tests**: `src/components/WaveformDisplay.test.tsx`

```
WaveformDisplay
  ✓ renders a canvas element
  ✓ canvas has correct dimensions
  ✓ applies playing color when state is PLAYING
  ✓ applies recording color when state is RECORDING
  ✓ applies muted color when state is MUTED
  ✓ renders without crashing when waveformData is empty
  ✓ renders playhead line when currentPosition provided
```

---

### Component: `EmptyState`

**File**: `src/components/EmptyState.tsx`

```typescript
// Renders:
//   Centered message: "Press Record to start your first loop"
//   Visual hint or icon
```

**Tests**: `src/components/EmptyState.test.tsx`

```
EmptyState
  ✓ renders the instructional message
  ✓ contains text about recording
```

---

## Utility Functions

### `src/utils/audioHelpers.ts`

```typescript
/** Concatenate multiple Float32Arrays into one */
function concatFloat32Arrays(arrays: Float32Array[]): Float32Array;

/** Trim a buffer to a target length */
function trimBuffer(buffer: Float32Array, targetLength: number): Float32Array;

/** Pad a buffer with silence to reach target length */
function padBuffer(buffer: Float32Array, targetLength: number): Float32Array;

/** Trim or pad buffer to match exact target length */
function fitBufferToLength(buffer: Float32Array, targetLength: number): Float32Array;

/** Downsample an audio buffer to N peak values for waveform display */
function generateWaveformPeaks(buffer: Float32Array, numPoints: number): number[];

/** Clamp a number to a min/max range */
function clamp(value: number, min: number, max: number): number;

/** Generate a unique track ID */
function generateTrackId(): string;
```

**Tests**: `src/utils/audioHelpers.test.ts`

```
audioHelpers
  concatFloat32Arrays()
    ✓ concatenates two arrays into one
    ✓ handles empty input array
    ✓ handles single array input
    ✓ preserves all values in order

  trimBuffer()
    ✓ returns first N samples
    ✓ returns original if already shorter than target
    ✓ handles target length of 0

  padBuffer()
    ✓ pads with zeros to target length
    ✓ returns original if already longer than target
    ✓ preserves original samples at the start

  fitBufferToLength()
    ✓ trims a longer buffer
    ✓ pads a shorter buffer
    ✓ returns same-length buffer unchanged

  generateWaveformPeaks()
    ✓ returns correct number of peaks
    ✓ peaks are absolute values between 0 and 1
    ✓ returns zeros for silent audio
    ✓ handles empty buffer

  clamp()
    ✓ returns value if within range
    ✓ returns min if value is below
    ✓ returns max if value is above

  generateTrackId()
    ✓ returns a non-empty string
    ✓ returns unique values on each call
```

---

## Implementation Phases (TDD Workflow)

Each phase follows the **Red → Green → Refactor** cycle:
1. **Red**: Write failing tests first
2. **Green**: Write minimum code to pass the tests
3. **Refactor**: Clean up code while keeping tests green

### Phase 1: Project Setup
- Initialize Vite + React + TypeScript project
- Install dependencies: `vitest`, `@testing-library/react`, `zustand`
- Configure Vitest with Web Audio API mocks
- Create folder structure:
  ```
  src/
    engine/
    store/
    components/
    utils/
    types.ts
  ```
- Verify setup with a trivial passing test

### Phase 2: Types & Utilities
- **Tests first**: Write tests for all enums, interfaces, and utility functions
- **Implement**: `src/types.ts` and `src/utils/audioHelpers.ts`
- **Refactor**: Ensure clean exports, consistent naming

### Phase 3: AudioTrack
- **Tests first**: Write all `AudioTrack.test.ts` tests
- **Implement**: `AudioTrack` class
- **Refactor**: Optimize `getSampleBatch` for performance

### Phase 4: AudioMixer
- **Tests first**: Write all `AudioMixer.test.ts` tests
- **Implement**: `AudioMixer` class
- **Refactor**: Ensure no unnecessary allocations in the mix loop

### Phase 5: AudioRecorder
- **Tests first**: Write all `AudioRecorder.test.ts` tests (with mocked Web Audio API)
- **Implement**: `AudioRecorder` class
- **Refactor**: Ensure clean resource cleanup in `dispose()`

### Phase 6: LoopEngine
- **Tests first**: Write all `LoopEngine.test.ts` tests (mocking AudioRecorder)
- **Implement**: `LoopEngine` class — the main orchestrator
- **Refactor**: Ensure event emission is consistent and complete

### Phase 7: Zustand Store
- **Tests first**: Write all `useLooperStore.test.ts` tests (mocking LoopEngine)
- **Implement**: `useLooperStore` with all actions
- **Refactor**: Ensure minimal re-renders by using Zustand selectors

### Phase 8: UI Components (Bottom-up)
- **Tests first** for each component, implementing one at a time:
  1. `EmptyState` (simplest)
  2. `WaveformDisplay` (canvas rendering)
  3. `LoopProgressBar`
  4. `TrackRow`
  5. `TrackList`
  6. `TransportBar`
  7. `App` (integration)
- **Implement** each component to pass its tests
- **Refactor**: Apply consistent styling, ensure accessibility

### Phase 9: Integration & Polish
- End-to-end manual testing in browser
- Fix any timing/sync issues discovered in real audio playback
- Dark theme CSS
- Keyboard shortcuts (R = record, Space = play/stop, M = mute selected)
- Performance optimization for waveform rendering

### Phase 10: Build & Deploy
- Production build configuration
- Test on Chrome, Firefox, Safari (Web Audio API compatibility)
- Deploy to static hosting (Vercel, Netlify, or GitHub Pages)

---

## File Structure (Final)

```
src/
├── types.ts                          # Enums, interfaces, type definitions
├── App.tsx                           # Root component
├── App.test.tsx
├── main.tsx                          # Vite entry point
├── index.css                         # Global styles, dark theme
│
├── engine/
│   ├── AudioRecorder.ts              # Mic input capture
│   ├── AudioRecorder.test.ts
│   ├── AudioTrack.ts                 # Single track buffer + controls
│   ├── AudioTrack.test.ts
│   ├── AudioMixer.ts                 # Multi-track mixing
│   ├── AudioMixer.test.ts
│   ├── LoopEngine.ts                 # Main orchestrator
│   └── LoopEngine.test.ts
│
├── store/
│   ├── useLooperStore.ts             # Zustand store
│   └── useLooperStore.test.ts
│
├── components/
│   ├── TransportBar.tsx
│   ├── TransportBar.test.tsx
│   ├── LoopProgressBar.tsx
│   ├── LoopProgressBar.test.tsx
│   ├── TrackList.tsx
│   ├── TrackList.test.tsx
│   ├── TrackRow.tsx
│   ├── TrackRow.test.tsx
│   ├── WaveformDisplay.tsx
│   ├── WaveformDisplay.test.tsx
│   ├── EmptyState.tsx
│   └── EmptyState.test.tsx
│
├── utils/
│   ├── audioHelpers.ts               # Buffer utilities
│   └── audioHelpers.test.ts
│
└── styles/
    ├── App.module.css
    ├── TransportBar.module.css
    ├── TrackRow.module.css
    ├── WaveformDisplay.module.css
    └── LoopProgressBar.module.css
```

---

## Test Summary

| Layer | File | Test Count |
|-------|------|-----------|
| Types | `types.test.ts` | 4 |
| Utilities | `audioHelpers.test.ts` | 17 |
| Engine | `AudioTrack.test.ts` | 24 |
| Engine | `AudioMixer.test.ts` | 12 |
| Engine | `AudioRecorder.test.ts` | 13 |
| Engine | `LoopEngine.test.ts` | 37 |
| Store | `useLooperStore.test.ts` | 20 |
| UI | `TransportBar.test.tsx` | 16 |
| UI | `LoopProgressBar.test.tsx` | 6 |
| UI | `TrackList.test.tsx` | 4 |
| UI | `TrackRow.test.tsx` | 11 |
| UI | `WaveformDisplay.test.tsx` | 7 |
| UI | `EmptyState.test.tsx` | 2 |
| UI | `App.test.tsx` | 5 |
| **Total** | | **~178** |
