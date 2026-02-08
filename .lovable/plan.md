
# Fix Medley Mode Levels 2 and 6 Mega Pad Placement

## The Problem

Medley mode levels 2 and 6 (0-indexed, meaning the 3rd and 7th levels played) generate terrain where the mega (moving) pad extends off the edge of the terrain into open space. This happens because the deterministic seed for these levels produces terrain/pad placement combinations that don't work properly.

## The Fix

Add a seed fixup table in `medleyConfig.ts` that applies an additional offset to the seed for these specific problematic stages. This changes the terrain and mega pad generation just enough to produce valid placements, without affecting any other levels.

## Technical Details

### File: `src/components/game/systems/medleyConfig.ts`

**Add a seed fixup map** above the `getMedleySeed` function:

```typescript
const MEDLEY_SEED_FIXUPS: Record<number, number> = {
  2: 31337,   // Level 2 (3rd played) - mega pad was going off terrain
  6: 71093,   // Level 6 (7th played) - mega pad was going off terrain
};
```

**Update `getMedleySeed`** to apply the fixup:

```typescript
export function getMedleySeed(medleyStage: number, difficulty: Difficulty): number {
  const normalizedStage = Math.max(1, medleyStage);
  const baseSeed = 942735;
  const difficultyOffset = difficulty === "hard" ? 200000 : 0;
  const earlyMedleyOffset = isEarlyMedleyNormalLevel(normalizedStage) ? 500000 : 0;
  const fixupOffset = MEDLEY_SEED_FIXUPS[normalizedStage] || 0;  // <-- NEW
  
  const finalSeed = baseSeed + difficultyOffset + earlyMedleyOffset + fixupOffset + normalizedStage * 7919;
  // ... rest unchanged
  return finalSeed;
}
```

### How It Works

- Level 2 currently generates seed `1,458,573` -- with the fixup (+31337) it becomes `1,489,910`, producing completely different terrain and mega pad placement
- Level 6 currently generates seed `1,490,249` -- with the fixup (+71093) it becomes `1,561,342`, also producing different terrain
- The fixup offset values are arbitrary prime-ish numbers chosen to shift the seed far enough to get a completely different terrain generation
- All other levels remain unchanged (fixup is 0 for them)
- Both "easy" and "hard" difficulty seeds are fixed since the fixup applies before the difficulty offset

### Summary

| File | Change |
|------|--------|
| `src/components/game/systems/medleyConfig.ts` | Add `MEDLEY_SEED_FIXUPS` map and apply it in `getMedleySeed` |

This is a single-file, ~5-line change. If the new seeds still produce bad placements (unlikely but possible), the fixup values can simply be adjusted to different numbers until a good result is found.
