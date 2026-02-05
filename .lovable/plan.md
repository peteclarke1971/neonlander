

# Plan: Starfield "Flying Through Space" Motion + New Effects + Settings

## Summary

This plan addresses three major enhancements:
1. Modify Neon Vortex and Prismatic Waves to have stars coming **toward the viewer** (flying through space feel)
2. Create 2 new stunning starfield effects with the same perspective motion
3. Add comprehensive starfield customization settings (density, speed, color cycle, neon color, glow, trails)

---

## Part 1: Modify Existing Starfields for "Flying Toward Viewer" Motion

### Current Issues

**Neon Vortex**: Stars orbit in a flat 2D spiral plane - no depth perception of "flying through space"

**Prismatic Waves**: Stars move horizontally left-to-right with vertical oscillation - feels like a side-scroller, not flying through space

### Solution: Z-Axis Perspective Projection

Both starfields need to be modified to use 3D perspective projection where:
- Stars spawn far away (high Z value)
- Stars move toward the viewer (decreasing Z)
- Stars project outward from center as they get closer (screen-space expansion)
- Stars respawn behind when they pass the camera

This is the same technique used in `HyperspaceStarfield` and `MobileStarfield` that creates the "flying through space" feel.

### NeonVortexStarfield.tsx Changes

Transform from orbital motion to perspective spiral:

```text
Current: Stars orbit center at fixed radius
New:     Stars spiral toward viewer with expanding outward motion
```

Key changes:
- Add `z` depth value to each star (0.1 to 1.5, normalized camera range)
- Use perspective projection: `screenX = centerX + (x / z) * focalLength`
- Stars move toward camera (`z -= speed * dt`)
- Apply spiral rotation as stars approach (`angle += angularSpeed / z`)
- Respawn at far distance when z drops below threshold
- Keep neon color cycling and pulse wave effects

### PrismaticWavesStarfield.tsx Changes

Transform from horizontal motion to perspective wave motion:

```text
Current: Stars move left-to-right with vertical wave
New:     Stars approach viewer in wave patterns, expanding outward
```

Key changes:
- Add `z` depth value to each star
- Project from center using perspective: particles expand outward as they approach
- Wave motion now affects the X/Y offset from the radial direction
- Stars spawn at far distance, move toward viewer
- Keep prismatic color shifting based on screen position
- Maintain comet trails (now pointing toward center, not left)

---

## Part 2: Create 2 New Starfield Effects

### Effect 1: "Cosmic Tunnel" (Wormhole/Tunnel Effect)

A cylindrical tunnel of stars that the viewer flies through, with:
- Stars arranged in concentric rings at varying depths
- Rings rotate as you approach
- Neon color bands that pulse through the tunnel
- Streaking trails creating a "hyperspace tunnel" effect
- Central glow/vortex at the vanishing point

**Visual Style**:
```text
        ·   ·   ·   ·   ·
      ·  ╭─────────╮  ·
    ·  ╭─╯         ╰─╮  ·
   · ╭─╯   ╭───╮    ╰─╮ ·
  · ╭╯    ╭╯   ╰╮    ╰╮ ·
  · │    │  ●   │     │ ·  ← Central glow
  · ╰╮    ╰╮   ╭╯    ╭╯ ·
   · ╰─╮   ╰───╯   ╭─╯ ·
    ·  ╰─╮       ╭─╯  ·
      ·  ╰───────╯  ·
        ·   ·   ·   ·   ·
```

**Key Features**:
- Stars positioned on rings at different Z depths
- Ring rotation increases as depth decreases (faster near viewer)
- Neon color cycles through ring layers
- Central glow pulsates with breathing animation
- Long streaking trails toward edges

### Effect 2: "Nebula Drift" (Particle Cloud Effect)

A flowing nebula of colored gas clouds with embedded stars:
- Large, soft nebula "puffs" drifting toward viewer
- Embedded bright stars that streak through
- Multiple layered nebula colors (pink, purple, cyan gradients)
- Parallax depth with closer nebulas moving faster
- Occasional bright "shooting stars" cutting through

**Visual Style**:
```text
      ░░░▒▒▓▓    ▒▒░░
    ░░▒▒▓▓████▓▓▒▒░░
   ░▒▓██████████▓▒░  ★
  ░▒▓████ ★ █████▓▒░
   ░▒▓██████████▓▒░
    ░░▒▒▓▓████▓▓▒▒░░
      ░░░▒▒▓▓    ▒▒░░
         ★
```

**Key Features**:
- Nebula puffs: Large radial gradients with soft edges
- 3 layers of nebula depth (back, mid, front)
- Embedded stars with perspective projection
- Color palette: Pink/magenta, purple, cyan blending
- Occasional shooting stars (fast, bright, long trails)
- Gentle rotation of nebula puffs as they approach

---

## Part 3: Starfield Settings

### New Settings (localStorage Keys)

| Setting | Key | Default | Range | Description |
|---------|-----|---------|-------|-------------|
| Particle Density | `ll-starfield-density` | 1.0 | 0.3 - 2.0 | Multiplier for star count |
| Speed | `ll-starfield-speed` | 1.0 | 0.3 - 3.0 | Animation speed multiplier |
| Color Cycle | `ll-starfield-color-cycle` | true | on/off | Enable neon color cycling |
| Color Cycle Speed | `ll-starfield-color-speed` | 1.0 | 0.2 - 3.0 | Speed of color transitions |
| Primary Neon Color | `ll-starfield-neon-hue` | 280 | 0 - 360 | Base hue (purple default) |
| Glow Intensity | `ll-starfield-glow` | 1.0 | 0 - 2.0 | Star glow radius multiplier |
| Trail Length | `ll-starfield-trail` | 1.0 | 0 - 2.0 | Motion trail length |
| Bloom | `ll-starfield-bloom` | 0.5 | 0 - 1.0 | Central glow/bloom intensity |

### Settings UI Design (Controls.tsx)

Add a new collapsible section "Starfield Effects" that appears when any non-"auto" style is selected:

```
┌─────────────────────────────────────────────┐
│ Starfield Style                             │
│ [Dropdown: Neon Vortex ▼]                   │
│                                             │
│ ▼ Starfield Customization                   │
│ ┌─────────────────────────────────────────┐ │
│ │ Particle Density  [━━━━━●━━━] 1.2x      │ │
│ │ Speed            [━━●━━━━━━] 0.7x       │ │
│ │ Color Cycling    [ON]                   │ │
│ │ Cycle Speed      [━━━━━●━━━] 1.0x       │ │
│ │ Base Neon Hue    [━━━●━━━━━] 280°       │ │
│ │   Preview: ████ (purple)                │ │
│ │ Glow Intensity   [━━━━━●━━━] 1.0x       │ │
│ │ Trail Length     [━━━━━━━●━] 1.5x       │ │
│ │ Bloom Effect     [━━━●━━━━━] 0.5        │ │
│ │                                         │ │
│ │ [Reset to Defaults]                     │ │
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

### Passing Settings to Starfield Components

Create a shared hook/config that all starfield components read:

```typescript
// lib/starfieldConfig.ts
export interface StarfieldConfig {
  density: number;
  speed: number;
  colorCycle: boolean;
  colorSpeed: number;
  neonHue: number;
  glow: number;
  trail: number;
  bloom: number;
}

export function loadStarfieldConfig(): StarfieldConfig {
  return {
    density: parseFloat(localStorage.getItem('ll-starfield-density') || '1'),
    speed: parseFloat(localStorage.getItem('ll-starfield-speed') || '1'),
    colorCycle: localStorage.getItem('ll-starfield-color-cycle') !== 'false',
    colorSpeed: parseFloat(localStorage.getItem('ll-starfield-color-speed') || '1'),
    neonHue: parseInt(localStorage.getItem('ll-starfield-neon-hue') || '280'),
    glow: parseFloat(localStorage.getItem('ll-starfield-glow') || '1'),
    trail: parseFloat(localStorage.getItem('ll-starfield-trail') || '1'),
    bloom: parseFloat(localStorage.getItem('ll-starfield-bloom') || '0.5'),
  };
}
```

All starfield components will import and use this config to scale their effects accordingly.

---

## Files to Create

| File | Description |
|------|-------------|
| `src/components/game/CosmicTunnelStarfield.tsx` | Wormhole/tunnel effect |
| `src/components/game/NebulaDriftStarfield.tsx` | Nebula cloud effect |
| `src/lib/starfieldConfig.ts` | Shared config loader |

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/game/NeonVortexStarfield.tsx` | Convert to Z-axis perspective |
| `src/components/game/PrismaticWavesStarfield.tsx` | Convert to Z-axis perspective |
| `src/pages/Controls.tsx` | Add new dropdown options + customization sliders |
| `src/components/game/PlayerMenu.tsx` | Import new components, add switch cases |

---

## Technical Implementation Details

### Perspective Projection Math

All starfield effects will use the same core projection:

```typescript
const focalLength = 400; // Perspective strength
const near = 0.05;       // Closest Z before respawn
const far = 1.5;         // Farthest Z (spawn distance)

// Project 3D point to 2D screen
const screenX = centerX + (star.x / star.z) * focalLength;
const screenY = centerY + (star.y / star.z) * focalLength;

// Scale size by depth (closer = larger)
const scale = 1 / star.z;

// Move toward viewer
star.z -= speed * dt;

// Respawn when too close
if (star.z < near) {
  star.z = far;
  star.x = (Math.random() - 0.5) * 2;
  star.y = (Math.random() - 0.5) * 2;
}
```

### Performance Considerations

- All effects target 60fps on iOS Safari
- Particle counts: Base 250-350, scaled by density setting
- No `shadowBlur` - use radial gradients for glow
- Pre-allocate all arrays (Float32Array where appropriate)
- Batch similar draw operations
- Limit gradient creation per frame

### Neon Vortex Spiral Enhancement

Add spiral twist as stars approach:

```typescript
// Angular velocity increases as z decreases (closer = faster rotation)
star.angle += (config.speed * 0.3 / star.z) * dt;

// Outward spiral expansion as z decreases
const spiralRadius = star.baseRadius * (1 / star.z);
const x = Math.cos(star.angle) * spiralRadius;
const y = Math.sin(star.angle) * spiralRadius;
```

### Prismatic Waves 3D Transform

Convert wave motion to radial:

```typescript
// Each star has an angle from center
const radialX = Math.cos(star.angle);
const radialY = Math.sin(star.angle);

// Wave offset perpendicular to radial direction
const waveOffset = Math.sin(star.z * star.frequency + star.phase) * star.amplitude;
const perpX = -radialY * waveOffset * 0.1;
const perpY = radialX * waveOffset * 0.1;

// Final 3D position
const x = radialX * star.radius + perpX;
const y = radialY * star.radius + perpY;

// Project to screen
const screenX = centerX + (x / star.z) * focalLength;
const screenY = centerY + (y / star.z) * focalLength;
```

---

## Implementation Order

1. Create `src/lib/starfieldConfig.ts` - Shared config loader
2. Modify `src/components/game/NeonVortexStarfield.tsx` - Add Z perspective + config integration
3. Modify `src/components/game/PrismaticWavesStarfield.tsx` - Add Z perspective + config integration
4. Create `src/components/game/CosmicTunnelStarfield.tsx` - New tunnel effect
5. Create `src/components/game/NebulaDriftStarfield.tsx` - New nebula effect
6. Update `src/pages/Controls.tsx` - Add dropdown options + customization section
7. Update `src/components/game/PlayerMenu.tsx` - Import and render new starfields

---

## New Dropdown Options

After implementation, the Starfield Style dropdown will have:

| Value | Label |
|-------|-------|
| `auto` | Auto (Default) |
| `hyperspace` | Hyperspace (3D) |
| `mobile` | Radial Burst |
| `vortex` | Neon Vortex |
| `waves` | Prismatic Waves |
| `tunnel` | Cosmic Tunnel |
| `nebula` | Nebula Drift |

