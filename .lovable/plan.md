

# Reset Global Ghosts and High Scores

## What we'll do

### 1. Delete ghost records (keep only timetrial)
Delete all rows from `ghost_records` where `mode != 'timetrial'`. This removes fixed and medley ghosts so new players can set their own.

### 2. Reset global high scores
Delete ALL rows from `scores`, then insert exactly 5 seed entries per mode (classic, fixed, medley, survival). Timetrial scores will also be preserved by re-inserting them after reading.

Seed scores per mode:
| Rank | Initials | Score |
|------|----------|-------|
| 1 | IH | 75,000 |
| 2 | EWC | 50,000 |
| 3 | PHI | 30,000 |
| 4 | FAD | 15,000 |
| 5 | LUM | 7,500 |

### 3. Preserve timetrial scores
Read existing timetrial scores before deletion, then re-insert them.

### Implementation
All done via database data operations (insert tool) — no code changes needed. The `No deletes allowed` RLS policy on scores uses `RESTRICTIVE` with `false`, which blocks deletes via the client. We'll need a temporary migration to delete and re-seed, or use the insert tool which bypasses RLS.

**Steps:**
1. Read timetrial scores to preserve
2. Delete all non-timetrial ghost records
3. Delete all non-timetrial scores
4. Insert 5 seed rows × 4 modes (classic, fixed, medley, survival) = 20 rows

