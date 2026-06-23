# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**DAW Host** is a traditional desktop DAW being built to host third-party audio plugins (VST3, AU, CLAP) via a native JUCE sidecar, with a React UI in Electron. The primary user-facing mode is the **linear timeline DAW** (`DawView`).

A **dormant loop-station mode** (`LooperView`, `LoopEngine`) remains in the codebase for reference and possible future fork — it is not exposed in the normal UI. Dev access only: `?mode=looper` or `VITE_ENABLE_LOOPER=true`.

See `projectoverview.md` for the full feature spec and the traditional DAW plan for implementation phases.

## Commands

- `npm run dev` — start Vite dev server (web UI only)
- `npm run build:native` — build JUCE `audio-host` sidecar (required before Electron)
- `npm run electron:dev` — Vite + Electron with native audio sidecar
- `npm run electron:start` — production build + Electron
- `npm test` — run all tests once (Vitest)
- `npm run test:watch` — run tests in watch mode
- `npm run build` — TypeScript check + production build
- `npm run lint` — ESLint

## Architecture

Three-layer architecture evolving toward: **JUCE sidecar (audio/plugins)** → **Electron main (IPC bridge)** → **React renderer (UI)**.

**Native audio host** (`native/audio-host/`) — JUCE console app, JSON-RPC over stdio:
- Phase 1: `ping`, `shutdown`, `get_devices`, `set_device`
- Future: plugin scan/load, transport, `AudioProcessorGraph` playback

**Electron** (`electron/`) — spawns sidecar via `AudioHostService`, exposes IPC to renderer.

**DAW (primary UI)** — `src/engine/DawEngine.ts`, `src/store/useDawStore.ts`, `src/components/DawView.tsx`:
- Linear timeline: record at playhead, clip arrangement, transport
- Evolving toward native JUCE sidecar for plugin hosting (Phase 1+)

**Looper (dormant)** — `src/engine/LoopEngine.ts`, `src/store/useLooperStore.ts`, `src/components/LooperView.tsx`:
- BOSS Loop Station–style overdub workflow; kept for tests and dev-only access
- Not wired into the default app shell

**Shared audio** (`src/engine/AudioRecorder.ts`, utilities in `src/engine/` and `src/utils/`):
- Web Audio mic capture; latency compensation and leveling utilities

## Key Constraints

- **Low latency is critical** for real-time audio
- **Plugin hosting requires native code** — browser Web Audio cannot load VST3/AU
- **TDD workflow** — tests written before implementation (Red → Green → Refactor)
