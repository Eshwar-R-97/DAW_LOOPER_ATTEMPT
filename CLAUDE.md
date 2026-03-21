# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DAW Looper is a loop-based Digital Audio Workstation designed for beatboxers, inspired by the BOSS Loop Station (RC-505mkII/RC-600). The core workflow: record a first track that sets the master loop length, then layer subsequent tracks via overdub while hearing previous tracks. Each track is independent with its own mute/volume controls.

See `projectoverview.md` for the full feature spec and `project_plan.md` for the implementation plan.

## Commands

- `npm run dev` — start dev server (Vite)
- `npm test` — run all tests once (Vitest)
- `npm run test:watch` — run tests in watch mode
- `npm run build` — TypeScript check + production build
- `npm run lint` — ESLint

## Architecture

Three-layer architecture: Audio Engine → Zustand Store → React UI.

**Audio Engine** (`src/engine/`) — Pure TypeScript, no DOM/React dependencies:
- `LoopEngine` — Main orchestrator: record → overdub → play lifecycle
- `AudioRecorder` — Mic capture via Web Audio API ScriptProcessorNode
- `AudioTrack` — Single track buffer with volume/mute/sample retrieval (looping via modulo wrap)
- `AudioMixer` — Sums samples from all tracks, applies master volume, clamps to [-1,1]

**State** (`src/store/`) — Zustand store bridges engine events to React. Engine emits `EngineEvent`s, store listens and updates, React re-renders via selectors.

**UI** (`src/components/`) — React components: TransportBar, LoopProgressBar, TrackList, TrackRow, WaveformDisplay, EmptyState.

## Key Constraints

- **Low latency is critical** — real-time audio performance tool
- **Sample-accurate loop sync** — all tracks stay aligned via shared playhead
- **First track's length = master loop length** — subsequent tracks trimmed/padded to fit
- **TDD workflow** — tests written before implementation (Red → Green → Refactor)
