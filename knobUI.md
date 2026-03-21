# RotaryKnob Component — Usage Guide

## Quick Start

```tsx
import { RotaryKnob } from './components/RotaryKnob'

<RotaryKnob
  value={myValue}
  onChange={(v) => setMyValue(v)}
  label="GAIN"
  size={48}
/>
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `number` | required | Current value |
| `onChange` | `(value: number) => void` | required | Called on every value change |
| `min` | `number` | `0` | Minimum value |
| `max` | `number` | `2.0` | Maximum value |
| `defaultValue` | `number` | `1.0` | Value restored on double-click |
| `size` | `number` | `48` | Diameter in pixels |
| `label` | `string` | — | Text below the knob (e.g., "VOL", "PAN") |
| `arcColor` | `string` | `#3b82f6` | Color of the filled arc indicator |

## Display Value

The knob displays a percentage calculated as:
```
displayPercent = Math.round((value / max) * 200)
```

This means with default `max=2.0`:
- value `0` → 0%
- value `1.0` → 100%
- value `2.0` → 200%

If you need a different display format (e.g., dB, Hz, ms), you'll need to add a `formatValue` prop to RotaryKnob.

## Interaction

- **Drag up/down** to increase/decrease
- **Shift + drag** for fine control (10x precision)
- **Scroll wheel** to adjust in steps
- **Double-click** to reset to `defaultValue`
- **Arrow keys** when focused (Up/Right = increase, Down/Left = decrease)
- **Home/End** keys jump to min/max
- **Touch** drag supported

## Sizing Guide

| Context | Recommended Size | Example |
|---------|-----------------|---------|
| Per-track controls | `36–44` | Track volume, track pan |
| Section controls | `48–56` | Master volume, master effects |
| Prominent/hero | `64–80` | Main tempo, central control |

## Styling

The knob uses CSS classes from `index.css`:
- `.knob-container` — outer wrapper (flex column, centered)
- `.knob-label` — value + name text below knob
- `.knob-value` — percentage text
- `.knob-name` — label text (uppercase, muted)

### Arc Colors

Use CSS variables for consistency:
```tsx
arcColor="var(--accent-blue)"    // default, general controls
arcColor="var(--accent-green)"   // active/enabled indicators
arcColor="var(--accent-red)"     // recording or destructive
arcColor="var(--accent-yellow)"  // highlighted or warning
arcColor="#a855f7"               // custom purple for effects
```

## Examples for Future Features

### Pan Knob
```tsx
<RotaryKnob
  value={panValue}       // -1.0 (left) to 1.0 (right)
  min={-1.0}
  max={1.0}
  defaultValue={0}       // center
  onChange={setPan}
  label="PAN"
  size={36}
/>
```

### Dry/Wet Effect Mix
```tsx
<RotaryKnob
  value={wetMix}         // 0.0 to 1.0
  min={0}
  max={1.0}
  defaultValue={0.5}
  onChange={setWetMix}
  label="MIX"
  size={44}
  arcColor="#a855f7"
/>
```

### Input Gain
```tsx
<RotaryKnob
  value={inputGain}
  min={0}
  max={4.0}             // up to 400%
  defaultValue={1.0}
  onChange={setInputGain}
  label="INPUT"
  size={48}
  arcColor="var(--accent-yellow)"
/>
```

## SVG Internals (for reference)

The knob renders a 270° arc (90° dead zone at the bottom):
- **Min position:** 225° (bottom-left)
- **Max position:** -45° (bottom-right)
- **Background arc:** Full 270° in `#404040`
- **Filled arc:** From 225° to current angle, colored with `arcColor`
- **Knob body:** Circle with radial gradient (`#3a3a3a` → `#222222`)
- **Pointer line:** From center to edge, colored with `arcColor`

### Drag Math
```
sensitivity = shiftKey ? 0.001 : 0.005
newValue = clamp(startValue + (startY - mouseY) * sensitivity * (max - min), min, max)
```
~200px of vertical drag covers the full range at normal sensitivity.
