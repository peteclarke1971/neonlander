

# Matrix-Style Typewriter Effect for Game Mode Descriptions

## What Changes

The game mode description text at the bottom of the mode selection sub-menu will be replaced with a Matrix/terminal-style typewriter animation. When you highlight a different mode, the text will appear character-by-character (like a computer terminal printout) with a blinking cursor at the end, using the Orbitron game font and the current neon color.

## Technical Details

### New Component: `src/components/game/TerminalText.tsx`

A reusable component that:
- Accepts a `text` string and renders it character-by-character at a configurable speed (~40ms per character)
- Shows a blinking block cursor (`_`) at the typing position
- When the `text` prop changes (new mode highlighted), resets and starts typing the new text from scratch
- Uses `fontFamily: '"Orbitron", sans-serif'` and `color: hsl(var(--neon))` to match the game aesthetic
- Cursor blinks at ~530ms interval using a simple `setInterval` toggle
- Uses `requestAnimationFrame`-friendly timing (setInterval for the typing cadence)

### File: `src/components/game/PlayerMenu.tsx`

Replace the static `<p>` description element (lines 868-873) with the new `<TerminalText>` component:

```text
BEFORE:
  <p className="text-xs text-center mt-2 opacity-70"
     style={{ color: "hsl(var(--muted-foreground))" }}>
    {gameModeOptions.find(m => m.id === selectedMode)?.description}
  </p>

AFTER:
  <TerminalText
    text={gameModeOptions.find(m => m.id === selectedMode)?.description || ""}
    className="text-xs text-center mt-2"
  />
```

### TerminalText Component Behavior

- **Typing speed**: ~40ms per character (fast enough to feel snappy, slow enough to read)
- **Cursor**: A `_` character that blinks on/off every 530ms, displayed after the last typed character
- **Reset**: When `text` changes, immediately clear displayed text and retype from the first character
- **Font**: Orbitron (game font)
- **Color**: `hsl(var(--neon))` with a subtle text-shadow glow for that terminal feel
- **Fixed height**: Uses `min-height` to prevent layout shift as text types out

### Summary

| File | Change |
|------|--------|
| `src/components/game/TerminalText.tsx` | New component -- Matrix-style typewriter with blinking cursor |
| `src/components/game/PlayerMenu.tsx` | Replace static `<p>` with `<TerminalText>` |

