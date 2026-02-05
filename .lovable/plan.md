

# Plan: Fix Hyperspace Settings, Add "Into the Void" Effect, New Customization Options, and Update PWA Icons

## Summary

This plan addresses four major areas:
1. **Fix Hyperspace starfield settings** - The config is loaded once at mount but never re-read in the animation loop
2. **Create new "Into the Void" starfield effect** - Concentric circles tunnel coming toward the viewer
3. **Add new customization options** - Particle size (up to 10x), motion blur slider, single color mode
4. **Update PWA icons and app name** - Replace icons with uploaded lander logo, change name to "LANDER"

---

## Part 1: Fix Hyperspace Settings Not Working

### Root Cause

In `HyperspaceStarfield.tsx`, the config is loaded once into a ref at mount time (line 43):
```typescript
const configRef = useRef(loadStarfieldConfig());
```

And reloaded once in the effect setup (line 133):
```typescript
configRef.current = loadStarfieldConfig();
```

**However**, this never updates when the user changes settings. The animation loop keeps reading the stale `configRef.current` values.

### Solution

Add a storage event listener and periodic config refresh to detect when settings change:

| File | Change |
|------|--------|
| `src/components/game/HyperspaceStarfield.tsx` | Add `storage` event listener to reload config when localStorage changes |

The same pattern used in other starfield components should be applied - listen for the `storage` event or periodically reload the config.

---

## Part 2: New Starfield Effect - "Into the Void"

### Visual Design

A pure concentric circles tunnel effect where rings expand outward from a central point:

```text
                ╭────╮
            ╭───╯    ╰───╮
        ╭───╯            ╰───╮
    ╭───╯        ●           ╰───╮
╭───╯                            ╰───╮
```

### Key Features

- **Concentric Rings**: Stars arranged on expanding circles at different Z depths
- **Ring Expansion**: Rings appear at center and expand outward as they approach viewer
- **Neon Color Bands**: Each ring has a cycling neon color
- **Motion Blur**: Long radial streaks from center outward
- **Particle Trails**: Stars leave trailing afterimages
- **Central Vanishing Point**: Bright core glow at center

### Technical Approach

```typescript
interface VoidStar {
  ringZ: number;        // Depth position (0.05 to 2.0)
  angleOnRing: number;  // Position on ring (0 to 2π)  
  baseRadius: number;   // Ring radius at z=1.0
  zSpeed: number;       // Speed toward viewer
  size: number;
  colorPhase: number;
}

// Projection math:
// Ring radius expands as z decreases: screenRadius = baseRadius * FOCAL_LENGTH / z
// Stars project outward from center as they approach
```

### Files to Create

| File | Description |
|------|-------------|
| `src/components/game/IntoTheVoidStarfield.tsx` | Concentric circles tunnel effect |

---

## Part 3: New Customization Options

### New Settings to Add

| Setting | localStorage Key | Default | Range | Description |
|---------|-----------------|---------|-------|-------------|
| Particle Size | `ll-starfield-particle-size` | 1.0 | 0.5 - 10.0 | Size multiplier for all particles |
| Motion Blur | `ll-starfield-motion-blur` | 0.5 | 0 - 1.0 | Blur/fade effect intensity |
| Single Color Mode | `ll-starfield-single-color` | false | on/off | Lock to current neon hue only |

### Update StarfieldConfig Interface

```typescript
// src/lib/starfieldConfig.ts
export interface StarfieldConfig {
  density: number;
  speed: number;
  colorCycle: boolean;
  colorSpeed: number;
  neonHue: number;
  glow: number;
  trail: number;
  bloom: number;
  // NEW:
  particleSize: number;    // 0.5 - 10.0
  motionBlur: number;      // 0 - 1.0
  singleColor: boolean;    // true = use only neonHue
}
```

### UI Controls to Add in Controls.tsx

```text
┌─────────────────────────────────────────────┐
│ Starfield Customization                     │
│                                             │
│ ... existing controls ...                   │
│                                             │
│ Particle Size    [━━━━━●━━━━━━━] 1.0x       │
│ (scales from 0.5x to 10x)                   │
│                                             │
│ Motion Blur      [━━━●━━━━━━━━━] 0.5        │
│ (adds radial blur/fade effect)              │
│                                             │
│ Single Color Mode [OFF]                     │
│ (when ON, uses only the Base Neon Color)   │
└─────────────────────────────────────────────┘
```

### Files to Modify

| File | Changes |
|------|---------|
| `src/lib/starfieldConfig.ts` | Add new config properties, storage keys, defaults |
| `src/pages/Controls.tsx` | Add new UI sliders and toggle for the new options |
| `src/components/game/HyperspaceStarfield.tsx` | Implement particleSize, motionBlur, singleColor |
| `src/components/game/MobileStarfield.tsx` | Implement particleSize, motionBlur, singleColor |
| `src/components/game/NeonVortexStarfield.tsx` | Implement particleSize, motionBlur, singleColor |
| `src/components/game/PrismaticWavesStarfield.tsx` | Implement particleSize, motionBlur, singleColor |
| `src/components/game/CosmicTunnelStarfield.tsx` | Implement particleSize, motionBlur, singleColor |
| `src/components/game/NebulaDriftStarfield.tsx` | Implement particleSize, motionBlur, singleColor |
| `src/components/game/IntoTheVoidStarfield.tsx` | Implement all settings (new file) |
| `src/components/game/PlayerMenu.tsx` | Add IntoTheVoidStarfield to switch statement |

---

## Part 4: PWA Icons and App Name Update

### Icon Updates

The uploaded lander logo image needs to be:
1. Copied to the public folder as new icon files
2. Referenced in manifest.json and index.html

| Source | Destination | Purpose |
|--------|-------------|---------|
| `user-uploads://AFCA166B-2764-4932-9C85-887AE852A712.png` | `public/apple-touch-icon.png` | iOS Home Screen icon |
| `user-uploads://AFCA166B-2764-4932-9C85-887AE852A712.png` | `public/icon-192.png` | PWA 192x192 icon |
| `user-uploads://AFCA166B-2764-4932-9C85-887AE852A712.png` | `public/icon-512.png` | PWA 512x512 icon |
| `user-uploads://AFCA166B-2764-4932-9C85-887AE852A712.png` | `public/favicon.png` | Browser tab favicon |

### App Name Changes

| File | Change |
|------|--------|
| `public/manifest.json` | Change `"name"` to `"LANDER"`, `"short_name"` to `"LANDER"` |
| `index.html` | Change `apple-mobile-web-app-title` to `"LANDER"`, update favicon reference |

### manifest.json Updates

```json
{
  "name": "LANDER",
  "short_name": "LANDER",
  "description": "Retro-inspired lunar lander with modern neon vectors, realistic physics, and satisfying landings.",
  ...
}
```

### index.html Updates

```html
<meta name="apple-mobile-web-app-title" content="LANDER" />
<link rel="icon" type="image/png" href="/favicon.png" />
```

---

## Implementation Order

1. **Copy icon file** to public folder for PWA/favicon use
2. **Update manifest.json** with new name "LANDER" and icon references
3. **Update index.html** with new app title and favicon
4. **Update starfieldConfig.ts** with new settings (particleSize, motionBlur, singleColor)
5. **Fix HyperspaceStarfield.tsx** - add config refresh mechanism + implement new settings
6. **Update all other starfield components** with new settings
7. **Create IntoTheVoidStarfield.tsx** - new concentric circles tunnel effect
8. **Update Controls.tsx** - add "Into the Void" to dropdown + new customization sliders
9. **Update PlayerMenu.tsx** - add IntoTheVoidStarfield to render switch

---

## Technical Details

### Motion Blur Implementation

Motion blur can be achieved by drawing multiple semi-transparent copies of each particle along its motion path:

```typescript
if (config.motionBlur > 0.1) {
  // Draw 3-5 blur copies
  const blurSteps = Math.floor(3 + config.motionBlur * 2);
  for (let b = 0; b < blurSteps; b++) {
    const blurT = b / blurSteps;
    const blurX = lerp(prevX, currentX, blurT);
    const blurY = lerp(prevY, currentY, blurT);
    const blurAlpha = baseAlpha * (1 - blurT) * config.motionBlur * 0.3;
    // Draw faded copy at blurX, blurY with blurAlpha
  }
}
```

### Single Color Mode Implementation

When enabled, bypass the color cycling and use only the neonHue:

```typescript
const finalHue = config.singleColor 
  ? config.neonHue 
  : (cycledHue + hueShift + 360) % 360;
```

### Config Refresh for Hyperspace

Add a storage event listener to detect changes:

```typescript
useEffect(() => {
  const handleStorageChange = () => {
    configRef.current = loadStarfieldConfig();
  };
  
  window.addEventListener('storage', handleStorageChange);
  
  // Also check periodically for same-tab changes
  const interval = setInterval(() => {
    configRef.current = loadStarfieldConfig();
  }, 500);
  
  return () => {
    window.removeEventListener('storage', handleStorageChange);
    clearInterval(interval);
  };
}, []);
```

---

## Files Summary

### Files to Create

| File | Description |
|------|-------------|
| `src/components/game/IntoTheVoidStarfield.tsx` | Concentric circles tunnel starfield |
| `public/favicon.png` | New favicon (copied from upload) |

### Files to Modify

| File | Description |
|------|-------------|
| `public/manifest.json` | Update name to "LANDER" |
| `index.html` | Update app title and favicon |
| `src/lib/starfieldConfig.ts` | Add particleSize, motionBlur, singleColor |
| `src/pages/Controls.tsx` | Add "Into the Void" dropdown option + new sliders |
| `src/components/game/PlayerMenu.tsx` | Add IntoTheVoidStarfield to render switch |
| `src/components/game/HyperspaceStarfield.tsx` | Fix config refresh + implement new settings |
| `src/components/game/MobileStarfield.tsx` | Implement new settings |
| `src/components/game/NeonVortexStarfield.tsx` | Implement new settings |
| `src/components/game/PrismaticWavesStarfield.tsx` | Implement new settings |
| `src/components/game/CosmicTunnelStarfield.tsx` | Implement new settings |
| `src/components/game/NebulaDriftStarfield.tsx` | Implement new settings |

### Files to Copy

| Source | Destination |
|--------|-------------|
| `user-uploads://AFCA166B-...` | `public/apple-touch-icon.png` |
| `user-uploads://AFCA166B-...` | `public/icon-192.png` |
| `user-uploads://AFCA166B-...` | `public/icon-512.png` |
| `user-uploads://AFCA166B-...` | `public/favicon.png` |

---

## New Dropdown Options After Implementation

| Value | Label |
|-------|-------|
| `auto` | Auto (Default) |
| `hyperspace` | Hyperspace (3D) |
| `mobile` | Radial Burst |
| `vortex` | Neon Vortex |
| `waves` | Prismatic Waves |
| `tunnel` | Cosmic Tunnel |
| `nebula` | Nebula Drift |
| `void` | Into the Void |

