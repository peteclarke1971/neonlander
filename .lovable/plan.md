

# Fix: Survival Game Over Screen - Match Classic/Fixed Styling

## Changes

### 1. Remove Global Leaderboard from Post-Initials View
Currently after entering initials in survival, the view switches to "home" which shows both the local leaderboard and the `OnlineLeaderboard` component. Instead, survival should stay on the game over screen and show only the local leaderboard (matching classic/fixed behavior).

### 2. Match Classic/Fixed Mission Failed Styling

The survival game over screen needs to adopt the same visual language as the classic/fixed mission failed screen:

**Current (Survival):**
- Generic `text-accent` heading
- `variant="outline"` / `variant="ghost"` buttons
- Simple card layout for stats
- No `font-display` usage
- No `animate-enter` class

**Target (Classic/Fixed style):**
- `font-display font-bold` on heading
- `variant="hero"` and `variant="neon"` buttons
- Inline score summary like: `Score: X · Distance: Ym · Time: Zs · Landings: N`
- `animate-enter` animation class on the section
- Local leaderboard shown after initials entry (no global)

---

## Technical Details

### File: `src/pages/Survival.tsx`

**Flow change:** After initials submission, instead of `setView("home")`, stay on `"gameover"` and set a flag like `showLeaderboardsAfterInitials = true` to display the local leaderboard on the game over screen (same pattern as Index.tsx).

**Game Over section changes:**
- Add `animate-enter` class to the section
- Change heading to use `font-display font-bold` classes
- Change stats from card layout to inline summary: `Score: X · Distance: Ym · Time: Zs · Landings: N`
- Change "Try Again" button from `variant="outline"` to `variant="neon"`
- Change "Back to Menu" button from `variant="ghost"` to `variant="hero"`
- After initials, show only local leaderboard (same card style as classic/fixed)
- Remove the `OnlineLeaderboard` import and usage from the game over flow (keep it on the home screen if desired)

**Initials submission handler:**
- Change `setView("home")` to `setNeedsInitials(false)` + `setShowLeaderboardsAfterInitials(true)` (stay on gameover)
- Still submit to online leaderboard in background, just don't display it

