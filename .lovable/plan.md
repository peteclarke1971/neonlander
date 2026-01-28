
# Add Style Points (360/720/1080 & Near Misses) to Survival Mode

## Overview
This plan adds the style scoring system from classic/fixed modes to survival mode, including:
- 360°/720°/1080° rotation bonuses
- Near miss detection and rewards
- All associated visual effects (particle bursts, floating score text, "NEAR MISS" text)

---

## Current Implementation Analysis

### In GameEngine.tsx (classic/fixed modes):

**State Management:**
- Uses `stylePointsStateRef` (a ref to `StylePointsState`)
- Imports from `systems/stylePoints.ts`: `createStylePointsState`, `update360Tracking`, `updateNearMiss`, `resetStylePoints`

**Visual Effect Types:**
```typescript
type StyleParticle = { id, x, y, vx, vy, life, maxLife, size, color }
type NearMissText = { id, x, y, text, life, maxLife }
type FloatingScoreText = { id, x, y, points, life, maxLife }
```

**Helper Functions:**
- `spawnStyle360Burst(px, py, terrainColor)` - Spawns 48 particles in circular burst
- `spawnNearMissText(px, py)` - Spawns floating "NEAR MISS" text
- `spawnFloatingScore(px, py, points)` - Spawns floating score number

**Tracking Logic (called in physics update loop):**
1. `update360Tracking()` - Tracks rotation input, returns award data when 360° completed
2. `updateNearMiss()` - Tracks proximity to terrain at speed, returns award when maintained 0.3s

**Rendering (in draw section):**
- Particle burst with glow and fade
- Near miss text floating upward with fade
- Floating score text scaling up with fade

---

## Implementation for SurvivalEngine.tsx

### 1. Add Imports

Add to imports section (~line 29):
```typescript
import { 
  createStylePointsState, 
  update360Tracking, 
  updateNearMiss, 
  resetStylePoints, 
  StylePointsState 
} from "./systems/stylePoints";
```

### 2. Add State Refs

Add after existing refs (~line 237):
```typescript
// Style points tracking (rotation bonuses & near misses)
const stylePointsStateRef = useRef<StylePointsState>(createStylePointsState());
```

### 3. Add Visual Effect Arrays

Inside the main `useEffect`, after the `debris` array declaration (~line 477):
```typescript
// Style points visual effects
type StyleParticle = {
  id: string;
  x: number; 
  y: number; 
  vx: number; 
  vy: number; 
  life: number; 
  maxLife: number;
  size: number;
  color: string;
};
const styleParticles: StyleParticle[] = [];

type NearMissText = {
  id: string;
  x: number;
  y: number;
  text: string;
  life: number;
  maxLife: number;
};
const nearMissTexts: NearMissText[] = [];

type FloatingScoreText = {
  id: string;
  x: number;
  y: number;
  points: number;
  life: number;
  maxLife: number;
};
const floatingScoreTexts: FloatingScoreText[] = [];
```

### 4. Add Helper Functions

Add after `spawnExplosion` function (~line 744):
```typescript
// Style points helper functions (matching GameEngine)
const spawnStyle360Burst = (px: number, py: number, terrainColor: string) => {
  const count = 48;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const speed = 150 + Math.random() * 100;
    const size = 3 + Math.random() * 5;
    styleParticles.push({
      id: `${Date.now()}_${i}`,
      x: px,
      y: py,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1.5,
      maxLife: 1.5,
      size,
      color: terrainColor
    });
  }
};

const spawnNearMissText = (px: number, py: number) => {
  nearMissTexts.push({
    id: `${Date.now()}`,
    x: px,
    y: py,
    text: "NEAR MISS",
    life: 2.0,
    maxLife: 2.0
  });
};

const spawnFloatingScore = (px: number, py: number, points: number) => {
  floatingScoreTexts.push({
    id: `score_${Date.now()}`,
    x: px,
    y: py,
    points: points,
    life: 0,
    maxLife: 0.5
  });
};
```

### 5. Add Style Tracking in Physics Update

After the rotation input handling section (~line 1220), before thrust controls:
```typescript
// Style points tracking (360°/720°/1080° rotations)
if (!isLanded && !isDead) {
  // Consolidate rotation input detection
  const gp = anyGamepad();
  let isRotatingLeft = keys.current.left;
  let isRotatingRight = keys.current.right;
  
  if (gp) {
    const input = readGamepad(gp, loadProfile(gp.id));
    const analogThreshold = 0.15;
    isRotatingLeft = isRotatingLeft || input.buttons.rotateLeft || input.rotation < -analogThreshold;
    isRotatingRight = isRotatingRight || input.buttons.rotateRight || input.rotation > analogThreshold;
  }
  
  const rotation360Result = update360Tracking(
    stylePointsStateRef.current,
    shipAngle,
    isRotatingLeft,
    isRotatingRight,
    dt,
    false, // No abort in survival mode
    currentTime
  );
  
  if (rotation360Result?.awarded) {
    const consecutiveCount = rotation360Result.consecutiveCount;
    const pointsAwarded = 360 * consecutiveCount; // 360, 720, or 1080
    
    currentScore += pointsAwarded;
    setScore(currentScore);
    
    spawnStyle360Burst(shipX, shipY, neonColor);
    spawnFloatingScore(shipX, shipY, pointsAwarded);
    
    // Play sound effect
    audio.current.click();
  }
  
  // Near miss tracking
  const nearMissResult = updateNearMiss(
    stylePointsStateRef.current,
    shipX,
    shipY,
    shipVx,
    shipVy,
    getHeightAt,
    (x) => getPadAt(x, shipY), // Wrapper to match expected signature
    dt,
    currentTime
  );
  
  if (nearMissResult?.awarded) {
    currentScore += 250;
    setScore(currentScore);
    spawnNearMissText(nearMissResult.awardX, nearMissResult.awardY);
    audio.current.click();
  }
}
```

### 6. Reset Style Points on Landing/Death

In the successful landing section (~line 1930) and death section:
```typescript
// Reset style points after landing
resetStylePoints(stylePointsStateRef.current);
```

### 7. Add Particle Update Logic

In the particle update section (~after line 2100):
```typescript
// Update style particles (360° burst)
for (let i = styleParticles.length - 1; i >= 0; i--) {
  const p = styleParticles[i];
  p.life -= dt;
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  if (p.life <= 0) {
    styleParticles.splice(i, 1);
  }
}

// Update near miss texts
for (let i = nearMissTexts.length - 1; i >= 0; i--) {
  const t = nearMissTexts[i];
  t.life -= dt;
  if (t.life <= 0) {
    nearMissTexts.splice(i, 1);
  }
}

// Update floating score texts
for (let i = floatingScoreTexts.length - 1; i >= 0; i--) {
  const text = floatingScoreTexts[i];
  text.life += dt;
  text.y -= 30 * dt;
  if (text.life >= text.maxLife) {
    floatingScoreTexts.splice(i, 1);
  }
}
```

### 8. Add Rendering Logic

In the rendering section, after thruster particles (~line 2895):
```typescript
// Render 360° particle burst (style points)
for (const particle of styleParticles) {
  const alpha = Math.max(0, particle.life / particle.maxLife);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = particle.color;
  ctx.shadowBlur = shouldOptimize ? 0 : 40;
  ctx.shadowColor = particle.color;
  ctx.beginPath();
  ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// Render near miss text (style points)
for (const text of nearMissTexts) {
  const alpha = text.life / text.maxLife;
  const yOffset = (1 - alpha) * 30;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = 'bold 16px "Orbitron", sans-serif';
  ctx.fillStyle = neonColor;
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 3;
  ctx.textAlign = 'center';
  ctx.strokeText(text.text, text.x, text.y - yOffset);
  ctx.fillText(text.text, text.x, text.y - yOffset);
  ctx.restore();
}

// Render floating score texts (rotation style points)
for (const text of floatingScoreTexts) {
  const t = text.life / text.maxLife;
  const alpha = 1 - t;
  const scale = 1 + t * 0.3;
  
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `bold ${24 * scale}px "Orbitron", monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = neonColor;
  ctx.shadowBlur = shouldOptimize ? 0 : 20;
  ctx.fillStyle = neonColor;
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 3;
  ctx.strokeText(text.points.toString(), text.x, text.y);
  ctx.fillText(text.points.toString(), text.x, text.y);
  ctx.restore();
}
```

---

## Files Modified

| File | Changes |
|------|---------|
| `src/components/game/SurvivalEngine.tsx` | Add style points imports, state refs, effect arrays, helper functions, tracking logic, update logic, rendering |

---

## Point Values (matching classic/fixed)

| Style Move | Points |
|------------|--------|
| 360° rotation | 360 |
| 720° rotation (2x consecutive) | 720 |
| 1080° rotation (3x consecutive) | 1080 |
| Near miss | 250 |

---

## Visual Effects Summary

| Effect | Description |
|--------|-------------|
| **360° Burst** | 48 particles explode outward from lander in circular pattern, glow + fade over 1.5s |
| **Floating Score** | Score points float upward, scale up 30%, fade out over 0.5s |
| **Near Miss Text** | "NEAR MISS" text floats upward 30px, fades over 2s |

All effects use the current neon color from the color zone system for visual consistency.
