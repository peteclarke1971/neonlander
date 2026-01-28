
# Comprehensive In-Game Guide System Implementation Plan

## Overview

This plan implements a two-part instruction system:
1. **GUIDE Popup** - A comprehensive multi-page guide accessible from the Player Menu (replaces LEADERBOARDS button)
2. **In Flight Guide Toggle** - Progressive contextual tips displayed during gameplay as elements are introduced

---

## Part 1: GUIDE Popup System

### Architecture

Create a new `GuidePopup.tsx` component that displays as an overlay on the Player Menu with:
- Multiple scrollable/swipeable pages
- Animated visual representations of game elements
- Gamepad and keyboard navigation support (consistent with existing menu systems)

### Menu Integration

**File: `src/components/game/PlayerMenu.tsx`**

Replace the "LEADERBOARDS" menu item with "GUIDE":

```typescript
const menuItems = [
  { id: "start", label: "START GAME" },
  { id: "modes", label: "CHOOSE GAME MODE" },
  { id: "startLevel", label: "STARTING LEVEL" },
  { id: "guide", label: "GUIDE" },  // Changed from "leaderboards"
  { id: "settings", label: "SETTINGS" },
];
```

Update `handleAction` to show the guide popup instead of calling `onLeaderboards()`.

### Guide Content Structure (8 Pages)

| Page | Title | Content |
|------|-------|---------|
| 1 | **BASIC CONTROLS** | Thrust, rotate left/right, abort. Animated lander with thrust particles. Touch vs keyboard/gamepad layouts. |
| 2 | **LANDING** | Safe landing requirements: angle, velocity thresholds. Animated landing sequence showing good vs crash. Bullseye bonus (centered), Speed bonus (< 10s). |
| 3 | **FUEL & SHIELDS** | Fuel consumption mechanics. Shield pickup (bubble visual). Shield bounce physics. Post-break invulnerability. |
| 4 | **SPACE JUNK** | Collectible items with rainbow cycling animation. 3 items unlock wormhole. 6 items in Collection levels. Fuel reward per pickup. |
| 5 | **HAZARDS** | Volcanoes (eruption warning), gravity wells (attraction zones), lightning storms (weather). UFOs (small/medium/large from level 10+). |
| 6 | **SCORING** | Points breakdown: landing base + finesse, Bullseye (+500), Speed Bonus (+500), Perfect Landing (+1000), 360 Rotation, Near Miss. |
| 7 | **GAME MODES** | Campaign, Classic, Time Trial, Survival, Medley. Brief description of each with distinctive visual. |
| 8 | **SURVIVAL MODE** | Endless terrain, distance tracking, sector milestones, comet bonuses, blackout zones, light storms. |

### Visual Animations (Canvas-based)

Each page will include small animated canvas elements:
- **Lander Animation**: Rotating ship with thrust particles
- **Landing Sequence**: Ship approaching pad with velocity indicator
- **Shield Bubble**: Pulsing pink/purple bubble around ship
- **Space Junk**: Spinning collectible with rainbow color cycling
- **Volcano**: Erupting particles
- **UFO Patrol**: Side-scrolling UFO with projectile

### New Files

```text
src/components/game/GuidePopup.tsx           - Main guide overlay component
src/components/game/guide/GuidePageControls.tsx    - Page 1 content
src/components/game/guide/GuidePageLanding.tsx     - Page 2 content  
src/components/game/guide/GuidePageFuelShields.tsx - Page 3 content
src/components/game/guide/GuidePageJunk.tsx        - Page 4 content
src/components/game/guide/GuidePageHazards.tsx     - Page 5 content
src/components/game/guide/GuidePageScoring.tsx     - Page 6 content
src/components/game/guide/GuidePageModes.tsx       - Page 7 content
src/components/game/guide/GuidePageSurvival.tsx    - Page 8 content
src/components/game/guide/LanderAnimation.tsx      - Reusable animated lander
```

### Navigation

- Left/Right arrows or swipe to change pages
- Page indicator dots at bottom
- Gamepad D-pad left/right for page navigation
- Back button or Escape to close
- Consistent `player-menu-btn` styling

---

## Part 2: In Flight Guide System

### Architecture

Create a progressive tip system that shows contextual instructions during gameplay based on:
1. First time playing (global)
2. Current level number
3. Current game mode
4. Elements being encountered for the first time

### State Management

**LocalStorage Keys** (prefix: `ll-guide-`):
```typescript
ll-guide-enabled: boolean           // Master toggle
ll-guide-basic-shown: boolean       // Controls tip shown
ll-guide-landing-shown: boolean     // Landing tip shown
ll-guide-junk-shown-{mode}: boolean // Space junk tip per mode
ll-guide-shield-shown: boolean      // Shield tip shown
ll-guide-volcano-shown: boolean     // Volcano tip shown
ll-guide-ufo-shown: boolean         // UFO tip shown
ll-guide-timetrial-shown: boolean   // Time trial rules
ll-guide-survival-shown: boolean    // Survival mode intro
ll-guide-blackout-shown: boolean    // Blackout zone tip
ll-guide-storm-shown: boolean       // Lightning storm tip
```

### Tip Trigger Points

| Level/Event | Tip Shown | Content |
|-------------|-----------|---------|
| Level 1 (any mode) | Basic Controls | "THRUST to ascend, ROTATE to aim. Land gently on pads!" |
| First landing | Landing Mechanics | "Green pads = safe. Land at low speed with level angle." |
| First space junk spawn | Collectibles | "Collect SPACE JUNK for fuel! 3 items opens WORMHOLE." |
| First shield pickup | Shield | "SHIELD protects from one crash. Bounces you to safety." |
| First volcano visible | Hazards | "VOLCANOES erupt! Avoid lava particles." |
| Level 10+ (first UFO) | UFOs | "UFO ALERT! Dodge projectiles or use shield." |
| Time Trial Level 1 | Time Trial | "Land on pads IN ORDER! Timer starts at first takeoff." |
| Survival Start | Survival | "Travel as far as you can! Land to refuel." |
| First blackout zone | Blackout | "BLACKOUT! Use your spotlight to navigate." |
| First storm level | Storm | "LIGHTNING STORM! Watch for strikes!" |

### Display Component

**File: `src/components/game/InFlightTip.tsx`**

A non-intrusive tip display positioned at top-center, similar to `SectorMessageDisplay.tsx`:
- Fade in/out animation
- Auto-dismiss after 4 seconds OR on any input
- Semi-transparent background
- Neon glow text matching level color
- Skip with any button press

### Integration Points

**File: `src/components/game/GameEngine.tsx`**

Add tip trigger checks at key points:
1. After countdown intro completes (level start)
2. When collectibles first spawned
3. When UFO first spawned
4. When volcano first becomes visible
5. On first successful landing

**File: `src/components/game/SurvivalEngine.tsx`**

Add survival-specific tips:
1. On game start (survival intro)
2. First blackout zone
3. First light storm
4. First comet bonus

### Player Menu Toggle

**File: `src/components/game/PlayerMenu.tsx`**

Add toggle in footer (near Ghost toggles):
```tsx
<button
  className="text-xs uppercase tracking-widest transition-opacity px-2 py-1 border rounded"
  onClick={() => toggleInFlightGuide()}
  style={{ 
    color: inFlightGuideEnabled ? "hsl(120, 100%, 60%)" : "hsl(var(--neon))",
    borderColor: inFlightGuideEnabled ? "hsl(120, 100%, 60% / 0.5)" : "hsl(var(--neon) / 0.3)",
    opacity: inFlightGuideEnabled ? 0.9 : 0.5,
  }}
>
  TIPS {inFlightGuideEnabled ? "ON" : "OFF"}
</button>
```

### New Files

```text
src/components/game/InFlightTip.tsx          - Tip display component
src/lib/inFlightGuide.ts                     - State management and tip definitions
```

---

## Technical Details

### Guide Popup Styling

Consistent with existing Player Menu aesthetic:
- `bg-background/80` with `backdrop-blur-[2px]`
- Border: `hsl(var(--neon) / 0.5)`
- Text: Orbitron font family
- Neon glow text shadows
- Responsive sizing for mobile

### Animation Specifications

**Lander Animation Canvas** (120x120px):
- 30 FPS animation loop
- Ship rotation demonstration
- Thrust particle system (simplified)
- requestAnimationFrame based

**Landing Sequence Canvas** (200x100px):
- Ship descending to pad
- Velocity vectors shown
- Color change: green (safe) to red (crash)

### Accessibility

- All text readable without animations
- Pause/skip option for animations
- Keyboard navigable throughout
- Screen reader labels for visual elements

---

## Implementation Order

1. Create `InFlightTip.tsx` component (simpler, existing pattern)
2. Create `src/lib/inFlightGuide.ts` for tip state management
3. Add In Flight Guide toggle to Player Menu footer
4. Integrate tip triggers into `GameEngine.tsx`
5. Integrate tip triggers into `SurvivalEngine.tsx`
6. Create `GuidePopup.tsx` main container
7. Create guide page components (8 pages)
8. Create animation components
9. Replace LEADERBOARDS with GUIDE in Player Menu
10. Test gamepad/keyboard navigation

---

## File Changes Summary

| File | Action |
|------|--------|
| `src/components/game/PlayerMenu.tsx` | Modify: Replace LEADERBOARDS with GUIDE, add TIPS toggle, add GuidePopup state |
| `src/components/game/GameEngine.tsx` | Modify: Add tip trigger points, import InFlightTip |
| `src/components/game/SurvivalEngine.tsx` | Modify: Add survival-specific tip triggers |
| `src/components/game/GuidePopup.tsx` | Create: Multi-page guide overlay |
| `src/components/game/guide/*.tsx` | Create: 8 page content components |
| `src/components/game/guide/LanderAnimation.tsx` | Create: Reusable lander animation |
| `src/components/game/InFlightTip.tsx` | Create: In-game tip display |
| `src/lib/inFlightGuide.ts` | Create: Tip state management |

---

## Storage Keys

All guide-related localStorage keys:
- `ll-guide-enabled` - Master toggle for in-flight tips
- `ll-guide-{tipId}-shown` - Individual tip shown flags
- `ll-guide-last-page` - Last viewed page in full guide (for resume)
