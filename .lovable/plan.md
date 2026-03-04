

# Fix Thruster Particle Alignment in Survival Mode

## Problem

The thruster nozzle spawn position uses an offset of `10` from the ship center, which places particles exactly at the ship body base (`y = 10` in local coords). The landing legs extend to `y = 12`. Since the ship is rendered AFTER particles (ship at line ~3512, particles at line ~3299), newly spawned particles are visually hidden behind the ship body for their first few frames, making the exhaust appear to emerge from the middle of the ship rather than from the bottom.

## Fix

Increase the nozzle offset from `10` to `14` so particles spawn clearly below the landing legs. This is a one-line constant change in `SurvivalEngine.tsx` at lines 1601-1609 (the nozzle position calculations).

**Before:** `shipX - Math.sin(shipAngle) * 10` / `shipY + Math.cos(shipAngle) * 10`
**After:** `shipX - Math.sin(shipAngle) * 14` / `shipY + Math.cos(shipAngle) * 14`

Apply to all three nozzle positions (center, left, right). Left/right lateral offset stays at `3`.

| File | Change |
|------|--------|
| `src/components/game/SurvivalEngine.tsx` | Update nozzle offset from `10` to `14` in all 5 nozzle position calculations (lines 1601-1609) |

