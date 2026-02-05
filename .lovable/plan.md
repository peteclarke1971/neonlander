

# Plan: Create Two New Stunning iOS Starfield Effects

## Summary

Create two visually impressive, iOS-optimized starfield components that provide high visual impact with neon color cycles, blur trails, and stunning effects while maintaining 60fps performance. Add them as new options in the Starfield Style dropdown.

---

## New Starfield Effects Overview

### Effect 1: "Neon Vortex" 
A swirling spiral vortex effect with:
- Stars moving in spiral patterns toward/from center
- Smooth neon color cycling (pink → purple → cyan → green → yellow → orange)
- Soft blur trails that follow the spiral motion
- Occasional "pulse waves" that ripple outward
- Glowing particles with variable brightness

### Effect 2: "Prismatic Waves"
A flowing wave-based effect with:
- Stars arranged in flowing wave patterns across screen
- Multi-colored neon gradients that shift across the waves
- Horizontal motion with vertical oscillation
- Streaking comet-like trails with glow halos
- Depth layers with parallax motion

---

## Technical Implementation

### New Files to Create

| File | Description |
|------|-------------|
| `src/components/game/NeonVortexStarfield.tsx` | Spiral vortex starfield with neon cycling |
| `src/components/game/PrismaticWavesStarfield.tsx` | Wave-based starfield with flowing motion |

### Files to Modify

| File | Change |
|------|--------|
| `src/components/game/PlayerMenu.tsx` | Add imports and conditional rendering for new starfields |
| `src/pages/Controls.tsx` | Add new options to Starfield Style dropdown |

---

## Effect 1: Neon Vortex Starfield

### Visual Design
```text
    ·  · ·      ·
   ·    ╔═══╗    ·
  ·   ╔═╝   ╚═╗   ·
 ·   ║  ◉ ◉ ◉  ║   ·
  ·  ╚══╗ ╔══╝  ·
   ·    ╚═╝    ·
    ·   · ·   ·
```

### Key Features
- **Spiral Motion**: Stars orbit center with varying radii and speeds
- **Color Cycling**: Each star cycles through neon palette independently with slight offsets
- **Blur Trails**: Motion blur achieved via drawing previous positions with decreasing alpha
- **Pulse Waves**: Periodic circular waves expand from center, affecting star brightness
- **Performance**: Uses Float32Arrays, minimal state, ~300 particles

### Core Algorithm
```typescript
interface VortexStar {
  angle: number;      // Current angle in radians
  radius: number;     // Distance from center (0-1)
  speed: number;      // Angular velocity
  size: number;       // Star size
  brightness: number; // Base brightness
  colorPhase: number; // Offset in color cycle
  layer: number;      // Depth layer (1-3)
}

// Update each frame:
star.angle += star.speed * dt * (1 + 0.5 / star.radius); // Faster near center
star.radius += (star.outward ? 0.02 : -0.02) * dt;       // Spiral in/out
```

---

## Effect 2: Prismatic Waves Starfield

### Visual Design
```text
  ~~~≈≈≈~~~≈≈≈~~~≈≈≈~~~
 ~~~≈≈≈≈≈≈~~~≈≈≈≈≈≈~~~≈≈
~~~≈≈≈≈≈≈≈≈≈~~~≈≈≈≈≈≈≈≈≈~~
  ≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈
~~~≈≈≈≈≈≈≈≈≈~~~≈≈≈≈≈≈≈≈≈~~
```

### Key Features
- **Wave Motion**: Stars follow sine wave paths with varying frequencies
- **Horizontal Flow**: Stars drift left-to-right (or right-to-left) across screen
- **Prismatic Colors**: Color gradient shifts across X position (rainbow effect)
- **Parallax Layers**: 3 depth layers with different speeds and sizes
- **Comet Trails**: Elongated gradient trails behind faster stars

### Core Algorithm
```typescript
interface WaveStar {
  x: number;           // Position (0 to screenWidth)
  baseY: number;       // Anchor Y position
  frequency: number;   // Wave frequency
  amplitude: number;   // Wave amplitude
  phase: number;       // Wave phase offset
  speed: number;       // Horizontal speed
  layer: number;       // Depth (affects speed, size, alpha)
}

// Update each frame:
star.x += star.speed * star.layer * dt;
const waveY = star.baseY + Math.sin(star.x * star.frequency + star.phase) * star.amplitude;
// Color based on x position in gradient
const hue = (star.x / width) * 360 + globalTime * 20;
```

---

## Implementation Details

### NeonVortexStarfield.tsx

```typescript
// Component structure
const NeonVortexStarfield: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const starsRef = useRef<VortexStar[]>([]);
  const pulseRef = useRef<{ time: number; active: boolean }>({ time: 0, active: false });
  
  // Neon palette (matching MobileStarfield)
  const NEON_COLORS = [
    { h: 330, s: 100, l: 65 }, // pink
    { h: 270, s: 100, l: 70 }, // purple  
    { h: 180, s: 100, l: 60 }, // cyan
    { h: 140, s: 100, l: 55 }, // green
    { h: 50, s: 100, l: 55 },  // yellow
    { h: 25, s: 100, l: 60 },  // orange
  ];
  
  // Initialize ~300 stars in spiral distribution
  // Main render loop:
  // 1. Clear with dark background + subtle vignette
  // 2. Draw pulse wave if active (expanding ring)
  // 3. For each star:
  //    - Calculate spiral position
  //    - Draw trail (3-5 previous positions with decreasing alpha)
  //    - Draw star with current neon color + glow
  // 4. Trigger pulse wave every 4-6 seconds
};
```

### PrismaticWavesStarfield.tsx

```typescript
// Component structure  
const PrismaticWavesStarfield: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const starsRef = useRef<WaveStar[]>([]);
  
  // Initialize ~350 stars across 3 layers
  // Main render loop:
  // 1. Clear with dark background
  // 2. Draw subtle horizontal gradient bands (very low alpha)
  // 3. For each star (sorted by layer for proper depth):
  //    - Calculate wave position
  //    - Calculate prismatic color from position
  //    - Draw elongated trail gradient
  //    - Draw star point with glow
  // 4. Apply subtle chromatic aberration at edges (optional)
};
```

---

## Performance Optimizations (Critical for iOS)

1. **Particle Count**: 300-350 stars max (vs 400 in MobileStarfield)
2. **No shadowBlur**: Use gradient fills instead for glow effects
3. **Batch Drawing**: Group similar operations
4. **Float32Arrays**: Efficient numeric storage
5. **Minimal Allocations**: Reuse color strings, avoid object creation in loop
6. **RAF Throttling**: Skip frames if dt too small
7. **No Complex Paths**: Simple arcs and lines only

---

## Settings Integration

### Controls.tsx Update
```typescript
<SelectContent>
  <SelectItem value="auto">Auto (Default)</SelectItem>
  <SelectItem value="hyperspace">Hyperspace (3D)</SelectItem>
  <SelectItem value="mobile">Radial Burst</SelectItem>
  <SelectItem value="vortex">Neon Vortex</SelectItem>
  <SelectItem value="waves">Prismatic Waves</SelectItem>
</SelectContent>
```

### PlayerMenu.tsx Update
```typescript
import { NeonVortexStarfield } from "./NeonVortexStarfield";
import { PrismaticWavesStarfield } from "./PrismaticWavesStarfield";

// In render:
const renderStarfield = () => {
  switch (starfieldStyle) {
    case 'hyperspace':
      return <HyperspaceStarfield ... />;
    case 'mobile':
      return <MobileStarfield ... />;
    case 'vortex':
      return <NeonVortexStarfield />;
    case 'waves':
      return <PrismaticWavesStarfield />;
    case 'auto':
    default:
      return isiOS ? <MobileStarfield ... /> : <HyperspaceStarfield ... />;
  }
};
```

---

## localStorage Key Values

| Key | New Valid Values |
|-----|------------------|
| `ll-starfield-style` | `"auto"`, `"hyperspace"`, `"mobile"`, `"vortex"`, `"waves"` |

---

## Implementation Order

1. **Create `NeonVortexStarfield.tsx`** - Full spiral vortex implementation
2. **Create `PrismaticWavesStarfield.tsx`** - Full wave pattern implementation  
3. **Update `Controls.tsx`** - Add "Neon Vortex" and "Prismatic Waves" options to dropdown
4. **Update `PlayerMenu.tsx`** - Import new components and add switch cases for rendering

---

## Visual Impact Summary

| Effect | Motion | Colors | Trails | Special |
|--------|--------|--------|--------|---------|
| Neon Vortex | Spiral in/out | Cycling neon | Curved blur | Pulse waves |
| Prismatic Waves | Horizontal + sine wave | Positional gradient | Comet streaks | Parallax layers |

Both effects prioritize visual "wow factor" while staying within iOS Safari's canvas performance limits.

