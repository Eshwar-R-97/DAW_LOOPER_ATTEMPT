# Volume Knob Revamp

## Overview

Replace all volume sliders with rotary knobs inspired by audio plugin UIs (FabFilter, Serum, Ableton). Each track gets its own rotary knob (0–200%), and a new master volume knob (0–200%) sits next to the sync offset control. The knobs follow the modern DAW convention: vertical drag interaction (drag up = increase, drag down = decrease) with SVG arc indicators showing the current value.

---

## What Needs to Change

### Backend / Audio Engine

**Minimal changes required — the engine already supports 0–2.0 volume range.**

1. **AudioTrack.ts** — Already clamps volume to [0, 2.0] and applies a squared gain curve (`gain = volume²`). No changes needed.
2. **AudioMixer.ts** — Master volume is currently clamped to [0, 1.0]. Change to [0, 2.0] to support 200% master volume.
3. **useLooperStore.ts** — Master volume state already exists (initialized at 1.0) and `setMasterVolume` action already delegates to the engine. No changes needed.

**Single backend change:** In `AudioMixer.ts`, update `setMasterVolume` and constructor to clamp to [0, 2.0] instead of [0, 1.0].

### Frontend / UI

1. **New `RotaryKnob` component** — Reusable SVG-based knob with arc indicator.
2. **TrackRow.tsx** — Replace `<input type="range">` volume slider with `<RotaryKnob>`.
3. **App.tsx** — Add master volume `<RotaryKnob>` next to the sync offset control.
4. **index.css** — Remove old slider styles, add knob styles.

---

## RotaryKnob Component Design

### Visual Design

Based on research into FabFilter, Serum, and modern browser DAWs (Soundtrap, BandLab):

- **Knob body:** Circle with subtle radial gradient (dark center to slightly lighter edge) for depth
- **Arc indicator:** SVG arc stroke around the knob, colored fill from min angle to current value
- **Pointer line:** A small line/notch on the knob face showing rotation position
- **Value label:** Percentage displayed below the knob (e.g., "75%")
- **Rotation range:** 270° (from 225° at min to -45° at max, leaving a 90° dead zone at the bottom)

### Interaction Model

Following the industry-standard vertical drag pattern used by most modern audio plugins:

- **Primary:** Vertical mouse drag — drag up to increase, drag down to decrease
- **Fine control:** Hold Shift while dragging for 10× precision
- **Mouse wheel:** Scroll up/down to adjust in steps
- **Double-click:** Reset to default value (100% for track, 100% for master)
- **Touch:** Same vertical drag via touchstart/touchmove/touchend
- **Keyboard:** Arrow keys when focused (Up/Right = increase, Down/Left = decrease)

### Props Interface

```typescript
interface RotaryKnobProps {
  value: number           // 0–2.0 (internal volume)
  min?: number            // default 0
  max?: number            // default 2.0
  defaultValue?: number   // for double-click reset, default 1.0
  size?: number           // diameter in px, default 48
  label?: string          // label text below knob (e.g., "VOL")
  arcColor?: string       // arc fill color, default accent blue
  onChange: (value: number) => void
}
```

### SVG Arc Math

The arc indicator uses SVG `stroke-dasharray` / `stroke-dashoffset` on a circular path:

```
totalArcLength = circumference × (270 / 360)
filledArcLength = totalArcLength × (value - min) / (max - min)
dasharray = totalArcLength
dashoffset = totalArcLength - filledArcLength
```

The pointer rotation angle:
```
angle = 225 - (270 × (value - min) / (max - min))
```
This maps value 0 → 225° (bottom-left) and value max → -45° (bottom-right).

### Drag Math

On mousedown, capture `startY` and `startValue`. On mousemove:

```
deltaY = startY - event.clientY          // positive = dragged up
sensitivity = shiftKey ? 0.001 : 0.005   // fine mode vs normal
newValue = clamp(startValue + deltaY × sensitivity × (max - min), min, max)
```

Sensitivity of 0.005 means ~200px of vertical drag covers the full range.

### Accessibility

- `role="slider"` with `aria-valuemin`, `aria-valuemax`, `aria-valuenow`
- `tabindex="0"` for keyboard focus
- Arrow key support: ±0.05 per press (±5%), Shift+Arrow ±0.01 (±1%)
- `aria-label` set from the `label` prop

---

## Implementation Steps

### Step 1: Backend — Extend Master Volume Range
- **File:** `src/engine/AudioMixer.ts`
- **Change:** Update `clamp(value, 0.0, 1.0)` to `clamp(value, 0.0, 2.0)` in `setMasterVolume` and constructor
- **Test:** Update `AudioMixer.test.ts` to verify master volume accepts values up to 2.0

### Step 2: Create RotaryKnob Component
- **File:** `src/components/RotaryKnob.tsx` (new)
- **What:** SVG-based knob with arc indicator, pointer, value label
- **Interaction:** Vertical drag, shift for fine mode, mouse wheel, double-click reset, keyboard arrows
- **Style:** Inline SVG + minimal CSS class for the container

### Step 3: Replace Track Volume Slider
- **File:** `src/components/TrackRow.tsx`
- **Change:** Replace `<input type="range">` and volume label with `<RotaryKnob>`
- **Props:** `value={track.volume}`, `onChange={onSetVolume}`, `label="VOL"`, `size={40}`
- **Layout:** Knob replaces the slider in `.track-controls`

### Step 4: Add Master Volume Knob
- **File:** `src/components/App.tsx`
- **Change:** Add `<RotaryKnob>` next to the sync offset control in the bottom controls area
- **Props:** `value={masterVolume}`, `onChange={setMasterVolume}`, `label="MASTER"`, `size={56}`
- **Layout:** Sits to the left of the sync offset slider

### Step 5: Update CSS
- **File:** `src/index.css`
- **Change:** Remove old `.volume-slider` styles, add `.knob-container` styles
- **Ensure:** Dark theme compatibility, consistent sizing with existing UI

### Step 6: Test & Polish
- Run `npm test` to verify no regressions
- Run `npm run dev` and verify knob interaction feels natural
- Check that per-track volume and master volume both work at 0%, 100%, 200%
- Verify muted tracks still show knob state correctly

---

## Files Modified

| File | Action |
|------|--------|
| `src/engine/AudioMixer.ts` | Extend master volume clamp to 2.0 |
| `src/engine/AudioMixer.test.ts` | Update tests for 2.0 max |
| `src/components/RotaryKnob.tsx` | **New** — reusable knob component |
| `src/components/TrackRow.tsx` | Replace slider with RotaryKnob |
| `src/App.tsx` | Add master volume RotaryKnob |
| `src/index.css` | Update styles |

## Design References

- **FabFilter Pro-Q / Pro-C:** Clean flat knobs with colored arc indicators — the gold standard for modern plugin UI
- **Serum (Xfer):** Flat knobs with clear value arcs, vertical drag interaction
- **Soundtrap / BandLab:** Browser DAWs using minimal flat knobs with arc indicators
- **BOSS RC-505mkII:** Physical faders for per-track volume, but compact rotary knobs are better suited for web UI where space is limited
- **react-knob-headless:** Reference architecture for headless/accessible React knob primitives
