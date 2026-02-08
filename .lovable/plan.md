
# Fix: Touch Thrust Zone Blocked by Controls Container

## The Problem

The touch controls container div spans the full width of the screen (from left edge to right edge) at a higher z-index (z-20) than the thrust overlay (z-10). Even though the actual buttons only occupy the left portion, the invisible container div blocks all touch events across its entire width from reaching the thrust overlay below. Moving the controls upward (via the vertical offset setting) pushes the blocking zone higher, matching the reported issue exactly.

```text
+--------------------------------------------+
|                                            |
|         THRUST ZONE (z-10)                 |
|         works here                         |
|                                            |
|............................................|
|  [◄] [►] [ABORT]  |   BLOCKED AREA        |  <-- controls container (z-20)
|  buttons (left)    |   (right side, no     |      spans full width
|                    |    buttons but still   |
|                    |    intercepts touch)   |
+--------------------------------------------+
```

## The Fix

Add `pointer-events: none` to the controls container div, and `pointer-events: auto` to each button. This makes the container "transparent" to touches, so they pass through to the thrust overlay, while the buttons themselves still capture input normally.

```text
+--------------------------------------------+
|                                            |
|         THRUST ZONE (z-10)                 |
|         works everywhere                   |
|                                            |
|............................................|
|  [◄] [►] [ABORT]  |   THRUST ZONE         |  <-- container is pointer-events-none
|  pointer-events    |   (touches pass       |      touches fall through to z-10
|  auto (captures)   |    through to z-10)   |
+--------------------------------------------+
```

## Technical Details

### File: `src/components/game/GameEngine.tsx`

**1. Add `pointer-events-none` to the controls container div (line ~6416)**

Change the container's className from:
`"absolute z-20 flex items-end justify-between gap-3 select-none"`
to:
`"absolute z-20 flex items-end justify-between gap-3 select-none pointer-events-none"`

**2. Add `pointer-events-auto` to each button**

Add `pointer-events-auto` to the className of:
- Left rotate button (line ~6429)
- Right rotate button (line ~6441)
- Abort button (line ~6453)

This ensures the buttons themselves still receive touch events while everything else in the container passes through.

### Why This Works

- The container div no longer captures any touch events (pointer-events-none)
- Touches on empty space within the container fall through to the thrust overlay (z-10) below
- The individual buttons opt back in (pointer-events-auto) so they still work normally
- No layout changes needed -- button positions, offsets, and scaling remain identical
- Works regardless of vertical/horizontal offset or scale settings

### Single File Change

| Change | Location | Lines |
|--------|----------|-------|
| Add `pointer-events-none` to container | className on line ~6416 | 1 line |
| Add `pointer-events-auto` to left rotate button | className on line ~6429 | 1 line |
| Add `pointer-events-auto` to right rotate button | className on line ~6441 | 1 line |
| Add `pointer-events-auto` to abort button | className on line ~6453 | 1 line |
