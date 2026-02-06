

# Revised Plan: Local + Global Leaderboard Overhaul

## What We're Doing

1. **Create a local leaderboard for Medley mode** (it currently has none -- scores go to localStorage but PlayerMenu only shows global)
2. **Standardize all local leaderboard seed data** across all modes with the same 5 entries
3. **Wipe and re-seed all global leaderboard tables** as a one-time database operation
4. **Fix medley "always a high score" bug** by reducing cap from 10 to 5 and adding seed data
5. **Add local/global alternation** to the PlayerMenu idle carousel

---

## Current State

### Local Leaderboards (localStorage)

| Mode | Storage Key | Seed Data | Status |
|------|------------|-----------|--------|
| Campaign (fixed) | `ll-highscores-fixed` | Yes (IH 100000, FIX 50000, etc.) | Exists but needs new seeds |
| Classic | `ll-highscores-classic` | Yes (IH 100000, LEM 50000, etc.) | Exists but needs new seeds |
| Survival | `survival-mode-high-scores` | Yes (SRV 15000, END 12000, etc.) | Exists but needs new seeds |
| Medley | `medleyHighScores_easy` / `medleyHighScores_hard` | No seeds at all | Needs creating with seeds |

### Global Leaderboard (Supabase `scores` table)

| Mode | Easy Count | Hard Count |
|------|-----------|-----------|
| classic | 2,815 entries (all 100,000) | 1,874 entries (all 5,000-25,000) |
| fixed | 2,799 entries (all 100,000) | 1,876 entries (all 5,000-25,000) |
| survival | 36 entries | 0 |
| medley | 82 entries | 0 |
| timetrial | 13 entries | 0 |

---

## Changes

### 1. Standardize All Local Seed Scores

Update `Index.tsx` (classic + fixed), `Survival.tsx`, and `medleyLeaderboard.ts` so that when no local scores exist, they all seed with:

| Rank | Initials | Score |
|------|----------|-------|
| 1 | IH | 50,000 |
| 2 | SDP | 30,000 |
| 3 | PC | 15,000 |
| 4 | ASH | 10,000 |
| 5 | IAN | 5,000 |

**Files affected:**
- `src/pages/Index.tsx` -- Update `classicScores` and `fixedScores` seed arrays (lines 58-64 and 76-81)
- `src/pages/Survival.tsx` -- Update survival seed array (lines 46-52)
- `src/lib/medleyLeaderboard.ts` -- Add seed scores function, change cap from 10 to 5

### 2. Fix Medley Leaderboard

In `src/lib/medleyLeaderboard.ts`:
- Add `getDefaultMedleyScores(difficulty)` returning the 5 standard seed scores
- Update `getMedleyHighScores` to return seeds when localStorage is empty
- Change `saveMedleyScore` to keep top **5** (not 10)
- Change `isMedleyHighScore` threshold from 10 to 5
- Change `getMedleyScoreRank` threshold from 10 to 5

### 3. Wipe and Re-seed Global Scores (One-Time Database Operation)

Delete ALL existing scores for classic, fixed, survival, and medley from the `scores` table, then insert the following 20 rows (5 per mode):

| Mode | Initials | Score | Difficulty |
|------|----------|-------|------------|
| classic | IH | 75,000 | easy |
| classic | EWC | 50,000 | easy |
| classic | PHI | 30,000 | easy |
| classic | FAD | 15,000 | easy |
| classic | LUM | 7,500 | easy |
| fixed | IH | 75,000 | easy |
| fixed | EWC | 50,000 | easy |
| fixed | PHI | 30,000 | easy |
| fixed | FAD | 15,000 | easy |
| fixed | LUM | 7,500 | easy |
| survival | IH | 75,000 | easy |
| survival | EWC | 50,000 | easy |
| survival | PHI | 30,000 | easy |
| survival | FAD | 15,000 | easy |
| survival | LUM | 7,500 | easy |
| medley | IH | 75,000 | easy |
| medley | EWC | 50,000 | easy |
| medley | PHI | 30,000 | easy |
| medley | FAD | 15,000 | easy |
| medley | LUM | 7,500 | easy |

This will be done as two SQL statements: DELETE then INSERT.

Note: The `timetrial` mode scores will NOT be touched (left as-is).

### 4. PlayerMenu Local/Global Alternation

**`src/components/game/PlayerMenu.tsx`:**
- Add a `leaderboardRound` ref that toggles between 0 (local) and 1 (global) each time the carousel completes a full cycle
- Pass `source` prop to `PlayerMenuLeaderboard`

**`src/components/game/PlayerMenuLeaderboard.tsx`:**
- Add `source: "local" | "global"` prop
- When `source === "global"`: Use existing `fetchTop()` behavior. Heading shows: `"GLOBAL HIGH SCORES - {label}"`
- When `source === "local"`: Read from the appropriate localStorage key. Heading shows: `"HIGH SCORES - {label}"`
- Local key mapping:
  - `fixed` -> `ll-highscores-fixed`
  - `classic` -> `ll-highscores-classic`
  - `survival` -> `survival-mode-high-scores`
  - `medley` -> `medleyHighScores_easy`

### 5. Add Medley Key to Controls.tsx Reset

Update the data reset function in `src/pages/Controls.tsx` to also clear `medleyHighScores_easy` and `medleyHighScores_hard`.

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/lib/medleyLeaderboard.ts` | Add seed scores, change cap to 5 |
| `src/pages/Index.tsx` | Update classic + fixed seed scores to new initials/values |
| `src/pages/Survival.tsx` | Update survival seed scores to new initials/values |
| `src/components/game/PlayerMenu.tsx` | Add local/global round alternation logic |
| `src/components/game/PlayerMenuLeaderboard.tsx` | Add `source` prop, local score reading, update headings |
| `src/pages/Controls.tsx` | Add medley keys to reset function |
| Database (SQL) | Delete all scores for 4 modes, insert 20 seed rows |

---

## Implementation Order

1. Database: Delete existing global scores and insert new seed data
2. `medleyLeaderboard.ts`: Add seeds, fix cap to 5
3. `Index.tsx`: Update classic + fixed seed scores
4. `Survival.tsx`: Update survival seed scores
5. `PlayerMenuLeaderboard.tsx`: Add source prop with local/global support
6. `PlayerMenu.tsx`: Add alternation logic
7. `Controls.tsx`: Add medley keys to reset

