

# Replicate GameEngine Touch Controls in Survival Mode

## Problem

SurvivalEngine's touch controls differ from GameEngine in several ways:
- Uses `variant="outline"` instead of `variant="neon"` (different visual style)
- No large button mode (`largeRotateButtons`) -- buttons are small text-based
- Missing the **ABORT button** entirely (abort logic exists but no touch button)
- Missing `pointer-events-none` on container / `pointer-events-auto` on buttons (the pass-through pattern)
- Missing `touch-none` class on the thrust overlay
- Missing `isIPad` check on thrust overlay visibility

## Changes to `src/components/game/SurvivalEngine.tsx`

1. **Thrust overlay**: Add `touch-none` class and include `isIPad` in the visibility condition (matching GameEngine line 6399)

2. **Touch controls container**: Add `pointer-events-none` class to the wrapper div (matching GameEngine line 6435)

3. **Rotate buttons**: 
   - Change `variant="outline"` to `variant="neon"`
   - Add `pointer-events-auto` class
   - Add large button styling: `text-5xl px-8 py-9 min-w-[80px] flex items-center justify-center leading-none`
   - Change labels from `'Rotate ◄'` / `'Rotate ►'` to just `'◄'` / `'►'`

4. **Add ABORT button** after the rotate buttons (inside the same flex container), matching GameEngine lines 6470-6481:
   - `variant="destructive"`, `pointer-events-auto`, Orbitron uppercase font
   - Wire to `keys.current.abort` and `abortAssist.current`

5. **Add `isIPad` detection** if not already present (for thrust overlay condition)

| File | Change |
|------|--------|
| `src/components/game/SurvivalEngine.tsx` | Update touch controls to match GameEngine: neon variant, large buttons, ABORT button, pointer-events pass-through |

