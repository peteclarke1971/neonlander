

# Fix Floating Static Pads and Mega Pad Terrain Issues in Classic Mode

## Problem Summary

Two terrain generation bugs in classic mode:

1. **Static pads floating in space** -- Regular and 2x pads sometimes appear disconnected from terrain, hanging in mid-air with no terrain beneath them
2. **Mega pads inside/off terrain** -- Moving MEGA pads sometimes travel through terrain geometry, extend off the edge into open space, or slide from flat terrain into a hillside

## Root Cause Analysis

### Floating Static Pads

The post-processing pass in `terrain.ts` (lines 555-611) creates a conflict when two pads have overlapping terrain-flattening regions:

```text
Pad A at idx 20, flattens indices 16-24 to height 350
Pad B at idx 25, flattens indices 21-29 to height 300

originalHeights captured AFTER both modifications.

Post-processing (reverse order):
  1. Pad B processed first -> re-flattens indices 21-29 to 300
  2. Pad A processed second -> re-flattens indices 16-24 to 350
     This OVERWRITES indices 21-24, changing terrain under Pad B!
  3. Pad B is now at y=300 but terrain under it is 350 -> PAD FLOATS
```

The overlap check during generation uses visual pad width (~30-170px), but the terrain flattening extends much further (up to +/-200px). Two pads can pass the overlap check while their flattening regions interfere with each other.

Additionally, the `originalHeights` map is populated AFTER pad generation has already modified terrain (line 387), despite the comment on line 145 saying "before any pad modifications."

### Mega Pads Off/Inside Terrain

The mega pad generator in `movingPads.ts` sets both endpoints to `maxTerrainY` (highest terrain point under the pad). But `terrain.ts` never flattens terrain along the mega pad's travel path. If terrain rises or falls between pos0 and pos1, the mega pad visually crosses through hills or floats above valleys. The validation only checks flatness at each endpoint independently, not the entire path between them.

## The Fix

### Fix 1: Final pad-terrain sync pass (terrain.ts)

After ALL terrain modifications and post-processing are complete, add a final pass that forces every static pad's Y coordinate to exactly match `getHeightAt(padCenterX)` -- the definitive interpolated terrain height. This guarantees visual consistency regardless of what happened during generation.

```text
BEFORE (current):
  Post-processing sets pad.y from originalHeights -> can mismatch terrain

AFTER (fixed):
  Final pass: pad.y = getHeightAt(padCenterX) for every pad
  Terrain is re-flattened one last time from lowest-index to highest-index
  Result: every pad sits exactly on its terrain
```

### Fix 2: Flatten terrain under mega pad path (terrain.ts)

After generating the mega pad, flatten the terrain along its entire travel path (from pos0.x to pos1.x). This ensures the mega pad never travels through or above terrain features.

```text
BEFORE (current):
  Mega pad generated -> terrain NOT modified -> pad crosses terrain

AFTER (fixed):
  Mega pad generated -> terrain flattened from pos0.x to pos1.x
  -> pad always travels on flat ground
```

### Fix 3: Constrain mega pad endpoints (movingPads.ts)

Add validation that mega pad endpoints stay safely within terrain bounds:
- Both endpoints must be at least 100px from world edges
- The terrain height variance along the entire path must be within tolerance
- For forced generation, shrink the pad width to fit flat terrain rather than placing it on uneven ground

## Technical Details

### File: `src/components/game/terrain.ts`

**Change 1: Capture true original heights BEFORE pad generation**

Move the `originalHeights` population from line 387 (after pad generation) to just before the pad generation loop (after cavern modifications but before pad placement).

**Change 2: Add terrain flattening for mega pads**

After the mega pad is generated and static pad overlap removal (after line 529), add code to:
1. Find the terrain segment indices that span from `pos0.x` to `pos1.x` (plus pad-width margin)
2. Set all terrain points in that range to the mega pad's Y coordinate
3. This ensures the terrain is flat along the entire mega pad travel path

**Change 3: Add final pad-terrain synchronization pass**

After the existing post-processing loop (after line 611), add a final forward pass over all pads:
1. For each pad, compute `padCenterX` and call `getHeightAt(padCenterX)` to get the true final terrain height
2. Set `pad.y` to this value
3. Re-flatten terrain indices around the pad to match
4. Log a warning if the correction was significant (more than 2px)

This pass runs LAST, after all other terrain modifications, so it uses the definitive terrain state.

### File: `src/components/game/systems/movingPads.ts`

**Change 4: Validate entire path for shuttle pads, not just endpoints**

In the `validatePath` method, for shuttle motion:
- Sample terrain height at 10+ points between pos0 and pos1
- Reject paths where terrain height varies by more than 3px from the pad's Y along the entire route
- For forced generation, shrink the travel width to only cover flat terrain segments

**Change 5: Add world-edge margin for all mega pad types**

In `generateMovingPad`, add constraints:
- Both pos0.x and pos1.x must be at least 100px from world edges (0 and worldWidth)
- Clamp endpoints if they exceed bounds

### Summary of Changes

| File | Change | Purpose |
|------|--------|---------|
| `terrain.ts` | Move originalHeights before pad gen | Capture true pre-pad terrain |
| `terrain.ts` | Flatten terrain under mega pad path | Prevent mega pad terrain conflicts |
| `terrain.ts` | Final pad-terrain sync pass | Eliminate all floating pad cases |
| `movingPads.ts` | Full-path terrain validation | Prevent mega pads on uneven terrain |
| `movingPads.ts` | World-edge margin enforcement | Prevent mega pads going off-world |

