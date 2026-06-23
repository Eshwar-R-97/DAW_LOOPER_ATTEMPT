# DAW Host

Traditional DAW with native plugin hosting (JUCE sidecar + Electron + React).

## Desktop dev (Electron + audio sidecar)

Run these as **two separate commands** (do not paste inline `#` comments):

```bash
npm run build:native
```

```bash
npm run electron:dev
```

First `build:native` takes a few minutes the first time (downloads JUCE). After that, only re-run it when `native/audio-host/` changes.

Web-only UI (no Electron, no sidecar):

```bash
npm run dev
```

## Tests

```bash
npm test
```
