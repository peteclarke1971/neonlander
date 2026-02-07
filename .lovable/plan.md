

# Fix: Survival Local Leaderboard Not Seeding on First Launch

## Problem

The Survival local leaderboard only gets seeded when the user navigates to the Survival page. Unlike Classic/Fixed (which seed on Index.tsx mount) and Medley (which auto-seeds via `getMedleyHighScores`), Survival's seed data is written inside a `useState` initializer that only runs when the Survival component mounts.

When the Player Menu tries to show local Survival scores before the user has ever visited that page, `localStorage.getItem("survival-mode-high-scores")` returns `null` and the leaderboard shows empty.

## Solution

Update the `readLocalScores` function in `PlayerMenuLeaderboard.tsx` to auto-seed any mode that has a missing localStorage key. This ensures the Player Menu always has data to display, even on a completely clean install.

## File to Modify

**`src/components/game/PlayerMenuLeaderboard.tsx`** -- Update `readLocalScores` function

### Current behavior (lines 28-35):
```typescript
const raw = localStorage.getItem(key);
if (!raw) return [];  // <-- Returns empty if key doesn't exist
```

### New behavior:
When the localStorage key is missing (returns null), generate the standard seed scores, write them to localStorage, and return them. This mirrors the pattern already used by `getMedleyHighScores`.

The seed data will use the same standardized entries:

| Rank | Initials | Score |
|------|----------|-------|
| 1 | IH | 50,000 |
| 2 | SDP | 30,000 |
| 3 | PC | 15,000 |
| 4 | ASH | 10,000 |
| 5 | IAN | 5,000 |

### Technical Detail

Add a helper function `getDefaultLocalScores()` that returns the 5 standard seed entries. In `readLocalScores`, when `localStorage.getItem(key)` returns `null` for any non-medley mode, call this helper, write the seeds to localStorage, and return them. This way Classic, Fixed, and Survival all auto-seed consistently -- even if their respective page components haven't mounted yet.

