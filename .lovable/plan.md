

# Reduce Volcano Eruption Frequency to 1/3 Current Rate

## Current State

Volcanoes erupt on these intervals (with a random 0.8-1.2x multiplier):

- Levels 5-8: every 8 seconds
- Levels 9-13: every 6 seconds
- Levels 14-40: every 4 seconds
- Levels 41+: every 3 seconds

## The Change

Multiply all `baseInterval` values by 3 to reduce eruption frequency to one-third:

- Levels 5-8: **24 seconds**
- Levels 9-13: **18 seconds**
- Levels 14-40: **12 seconds**
- Levels 41+: **9 seconds**

## Technical Details

### File: `src/components/game/systems/cavernVolcano.ts`

Four simple value changes in `getCavernVolcanoConfigForLevel`:

| Tier | Line | Current `baseInterval` | New `baseInterval` |
|------|------|----------------------|-------------------|
| baseLevel 0-3 | ~30 | 8 | 24 |
| baseLevel 4-8 | ~38 | 6 | 18 |
| baseLevel 9-35 | ~46 | 4 | 12 |
| baseLevel 36+ | ~54 | 3 | 9 |

Everything else (power, size, particle count, eruption duration) stays the same.

