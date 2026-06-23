# DAW Host - Project Overview

## Current Direction (2026)

This project is pivoting from a loop-station app to a **traditional DAW that hosts third-party plugins** (VST3, AU, CLAP). The default UI is the **linear timeline DAW** (`DawView`). Real plugin hosting will run in a **JUCE native sidecar** behind an **Electron** shell (see implementation plan).

**Looper mode** (BOSS Loop Station workflow below) remains in the codebase as dormant / unfinished code — not shown in the normal UI. It may be revived or forked to a separate project later.

---

## Legacy: Loop Station Mode (dormant)

The following sections describe the original loop-station vision, preserved for reference.

# DAW Looper - Original Vision


A browser/desktop DAW (Digital Audio Workstation) designed specifically for **beatboxers and vocal percussionists**, built around a **loop-based recording workflow** inspired by the **BOSS Loop Station** pedal series (RC-505mkII / RC-600). The core idea is to replicate and extend the intuitive record-overdub-layer workflow that beatboxers use in live performance, but in a software environment with additional features and visual feedback.

---

## Core Concept: The Looping Workflow

The system follows the same fundamental cycle as the BOSS Loop Station:

### 1. Record the First Track (Sets the Master Loop Length)

- The user presses **Record** to begin capturing audio.
- The user performs their first layer (typically a drum pattern via beatboxing).
- The user presses **Record** again (or a dedicated stop button) to end recording.
- **This first recording defines the master loop length** for the entire session. All subsequent tracks will conform to this length.
- Playback of Track 1 begins immediately and loops continuously.

### 2. Overdub / Layer Additional Tracks

- While Track 1 plays back, the user presses an **Overdub button** to begin recording the next track.
- The system **plays all existing tracks through the output** while simultaneously **recording new audio input** into a new, separate track.
- This allows the user to hear what they've already recorded and perform in sync with it.
- When the user presses the button again, recording stops and the new track begins looping alongside the others.
- Each new layer is captured as its **own independent track**, not mixed into a previous one.

### 3. Continue Layering

- Repeat Step 2 for as many tracks as needed.
- Typical beatboxer layering order:
  - **Track 1**: Drum pattern (kick, snare, hi-hats)
  - **Track 2**: Bass line (often pitch-shifted down)
  - **Track 3**: Chords / harmony / pads
  - **Track 4**: Melody or lead line
  - **Track 5+**: Additional layers, ad-libs, or variations
- All tracks loop in sync, aligned to the master loop length set by Track 1.

### 4. Live Performance Over the Loop

- Once all tracks are built up, the user can perform live over the looping arrangement.
- Tracks can be muted/unmuted in real time for dynamic arrangements (e.g., drop the drums for a breakdown, then bring them back).

---

## Reference: BOSS Loop Station (RC-505mkII / RC-600)

The BOSS Loop Station is the industry standard looping device for beatboxers. Understanding its workflow and features is essential to this project.

### How the BOSS Loop Station Works

| State       | Description                                                                 |
|-------------|-----------------------------------------------------------------------------|
| **Record**  | Capturing audio input. First press starts, second press stops.              |
| **Play**    | Loop plays back continuously. No new audio is being recorded.               |
| **Overdub** | Loop plays back while new audio is mixed/layered on top of the same track.  |
| **Stop**    | Track is silent. Playback position resets to the start.                     |
| **Mute**    | Track is silent but playback position continues (unmuting stays in sync).   |

### Record Action Modes (BOSS)

The BOSS pedals offer two configurable workflows:

- **REC → OVERDUB** (preferred by beatboxers): Press once = Record. Press again = enters Overdub mode (plays loop while recording new audio on top). Press again = Play only.
- **REC → PLAY**: Press once = Record. Press again = Play only. Press again = Overdub.

### Key BOSS Features to Reference

- **5-6 independent stereo tracks** (RC-505mkII has 5, RC-600 has 6)
- **Per-track controls**: Record/Play button, Stop button, Volume fader, Mute, FX toggle
- **Undo/Redo**: Removes or re-applies the most recent overdub layer
- **Loop Quantize**: Auto-corrects button press timing to the nearest beat/measure boundary
- **Tempo Sync**: All tracks lock to a common tempo grid
- **Bounce In**: Merge multiple tracks into one to free up track slots
- **Playback Modes**: Loop (continuous), One-shot, Reverse, Single
- **49 Input FX** and **53 Track FX** (pitch shift, harmony, vocoder, reverb, delay, etc.)
- **Built-in rhythm patterns** (200+ patterns, 16 drum kits)
- **99 phrase memories** for saving/loading loop sessions
- **Audio format**: 44.1 kHz, 32-bit float WAV, stereo

### How Beatboxers Use the BOSS Loop Station

1. **Set tempo** via tap tempo or built-in click track (monitored through headphones)
2. **Record drums** on Track 1 — sets the loop length
3. **Record bass** on Track 2 — often using pitch shift Input FX (-12 or -24 semitones)
4. **Record chords/pads** on Track 3 — using harmony or vocoder effects
5. **Record melody** on Track 4 — with reverb/delay for space
6. **Perform live** over all tracks, using mute/unmute for dynamics
7. **Use undo** to strip back layers for transitions, then rebuild

Notable beatboxers who use Loop Stations: MB14, Inkie, Saro, Rythmind, Gene Shinozaki. Competitive loopstation battles are organized by Swissbeatbox (SBX).

---

## Features: MVP (Minimum Viable Product)

### Must-Have Features

1. **Audio Recording via Microphone**
   - Capture audio input from the user's microphone
   - Low-latency monitoring

2. **Master Loop Length (Set by Track 1)**
   - First recorded track defines the loop duration
   - All subsequent tracks are constrained to this length

3. **Multi-Track Layering**
   - Record multiple independent tracks
   - Each track stored separately (not mixed into one)
   - Playback of existing tracks during recording of new ones

4. **Overdub Button Workflow**
   - Single button to start/stop recording of new layers
   - Existing tracks play back while new track is being recorded
   - Seamless transition from recording to looped playback

5. **Per-Track Controls**
   - **Mute/Unmute** each track independently
   - **Volume control** (slider/fader) per track
   - Visual indicator of track state (recording, playing, muted, stopped)

6. **Track UI**
   - Each track displayed separately with its own waveform visualization
   - Clear visual distinction between tracks
   - Track state indicators (recording = red, playing = green, muted = grey)

7. **Transport Controls**
   - Play All / Stop All
   - Visual loop position indicator (playhead or progress bar)

8. **Undo/Redo**
   - Undo the last recorded track (delete it)
   - Redo to bring it back

---

## Features: Future Enhancements (Post-MVP)

- **Loop Quantize**: Auto-correct recording start/stop to beat boundaries
- **Tap Tempo / Click Track**: Set BPM with tap or manual entry, metronome in headphones
- **Input Effects**: Pitch shift, reverb, delay, harmony applied before recording
- **Track Effects**: Effects applied to recorded/playing tracks
- **Bounce/Merge Tracks**: Combine multiple tracks into one to free up slots
- **Playback Modes**: One-shot, reverse, half-speed, double-speed
- **Save/Load Sessions**: Export and import loop sessions
- **WAV Export**: Export individual tracks or the full mix as WAV files
- **MIDI Sync**: Sync with external DAWs or hardware via MIDI clock
- **Keyboard Shortcuts**: Map record/overdub/mute to keyboard keys for quick control
- **Expression/Foot Pedal Support**: USB foot pedal integration for hands-free control
- **Built-in Drum Patterns**: Rhythm guide tracks with multiple kits

---

## Technical Considerations

### Audio Engine
- **Web Audio API** (if browser-based) or a native audio framework
- Low-latency audio input/output is critical for real-time performance
- Sample-accurate loop synchronization
- 44.1 kHz or 48 kHz sample rate, at least 16-bit depth

### Synchronization
- All tracks must start and end at exactly the same point
- Playback positions must stay locked across all tracks
- Recording of new tracks must align precisely with existing loop boundaries

### UI/UX
- Minimal, performance-friendly interface
- Large, easily clickable buttons (designed for use during live performance)
- Real-time waveform display for each track
- Clear visual feedback for all state changes (recording, playing, muted)
- Dark theme (standard for DAW/music applications)

### Platform
- TBD: Web app (React + Web Audio API), Desktop app (Electron/Tauri), or Native app
- Cross-platform compatibility preferred

---

## Summary

**DAW Host** is becoming a traditional plugin-hosting DAW. The loop-station workflow below was the original MVP; that code path is dormant while DAW + plugin hosting is the active direction.

---

DAW Looper (legacy summary): A loop-based recording application that brings the BOSS Loop Station workflow to software, tailored for beatboxers. The first track sets the loop length, subsequent tracks are layered on top via an overdub workflow, and each track is independently controllable.
