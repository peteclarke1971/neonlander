import React, { useEffect, useRef } from 'react';
import { IntroState, mix } from './CountdownIntro';

interface CountdownOverlayProps {
  state: IntroState;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  lowGraphics?: boolean;
  photosensitive?: boolean;
  shipPosition?: { x: number; y: number };
}

// Simple deterministic random number generator
function mulberry32(a: number) {
  return function() {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export const CountdownOverlay: React.FC<CountdownOverlayProps> = ({
  state,
  canvasRef,
  lowGraphics = false,
  photosensitive = false,
  shipPosition
}) => {
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const goPhaseStartRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = overlayCanvasRef.current;
    const gameCanvas = canvasRef.current;
    if (!canvas || !gameCanvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId: number | null = null;

    // iOS performance optimizations
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    
    // Clamp canvas resolution on mobile devices to prevent performance issues
    const dpr = isIOS ? Math.min(window.devicePixelRatio || 1, 2) : (window.devicePixelRatio || 1);
    const rect = gameCanvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const render = () => {
      if (state.phase === "inactive") return;
      if (state.phase === "done") { 
        // Clear entire canvas buffer and reset all state
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.shadowBlur = 0;
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
        goPhaseStartRef.current = null;
        return;
      }

      // Reset transform and clear entire canvas buffer (not just CSS dimensions)
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // Re-apply drawing scale for this frame
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      
      // Reset all canvas state at start of each frame
      ctx.shadowBlur = 0;
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;

      const centerX = width / 2;
      const centerY = height / 2;
      const minDim = Math.min(width, height);
      const baseSize = minDim * 0.24; // 24% of viewport

      const targetX = (shipPosition?.x ?? centerX);
      const targetY = (shipPosition?.y ?? centerY);

      // Create deterministic randomness for this state
      const rng = mulberry32(mix(0, "INTRO_RENDER", state.wordIndex));
      
      // Digit jiggle offset
      const jiggleX = (rng() - 0.5) * 12;
      const jiggleY = (rng() - 0.5) * 12;

      if (state.phase === "countdown" || state.phase === "go") {
        let alpha = 0;
        
        if (state.phase === "countdown") {
          // Calculate fade-in animation for countdown
          const fadeProgress = Math.min(state.timeInPhase / 120, 1); // 120ms fade-in
          const holdTime = 520; // 520ms hold
          const isHolding = state.timeInPhase > 120 && state.timeInPhase < (120 + holdTime);
          const isRinging = state.timeInPhase > (120 + holdTime);

          alpha = fadeProgress;
          if (isHolding) alpha = 1;
          if (isRinging) alpha = Math.max(0, 1 - ((state.timeInPhase - 120 - holdTime) / 200));
        } else if (state.phase === "go") {
          // GO phase - fade out over 600ms (use local timer to avoid reliance on external state updates)
          if (goPhaseStartRef.current == null) {
            goPhaseStartRef.current = performance.now() - state.timeInPhase;
          }
          const goElapsed = performance.now() - goPhaseStartRef.current;
          alpha = Math.max(0, 1 - goElapsed / 600);
        }

        // Draw the current word
        const isGO = state.currentWord === "GO";
        const fontSize = isGO ? baseSize * 1.15 : baseSize;
        
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.font = `${fontSize}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Apply glow effect (but disable on iOS to prevent performance issues)
        if (!isIOS && !photosensitive && !lowGraphics) {
          ctx.shadowColor = isGO ? '#ff6b6b' : '#4a9eff';
          ctx.shadowBlur = Math.min(baseSize * 0.2, 20); // Reduced from 0.4 and 40
        }
        
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 3;
        ctx.strokeText(state.currentWord, targetX + jiggleX, targetY + jiggleY);
        
        if (!isIOS && !lowGraphics) {
          ctx.shadowBlur = 0;
        }
        
        ctx.fillStyle = '#ffffff';
        ctx.fillText(state.currentWord, targetX + jiggleX, targetY + jiggleY);
        
        ctx.restore();

        // Draw expanding ring during ring phase (only for countdown, not GO)
        const isRinging = state.phase === "countdown" && state.timeInPhase > (120 + 520);
        if (isRinging && !photosensitive) {
          const ringProgress = (state.timeInPhase - 120 - 520) / 200;
          const ringRadius = baseSize * 0.8 * (1 + ringProgress * 2);
          const ringAlpha = Math.max(0, 1 - ringProgress);
          
          // Ring radius jitter
          const ringJitter = (rng() - 0.5) * 8;
          
          ctx.save();
          ctx.globalAlpha = ringAlpha;
          ctx.strokeStyle = '#00ffff';
          ctx.lineWidth = lowGraphics ? 1 : 2;
          ctx.beginPath();
          ctx.arc(targetX, targetY, ringRadius + ringJitter, 0, Math.PI * 2);
          ctx.stroke();
          
          // Extra micro-ring for GO
          if (isGO && !lowGraphics) {
            ctx.globalAlpha = ringAlpha * 0.6;
            ctx.beginPath();
            ctx.arc(targetX, targetY, ringRadius * 1.3 + ringJitter, 0, Math.PI * 2);
            ctx.stroke();
          }
          
          ctx.restore();
        }

        // Draw dotted circle around lander (visible from the start of countdown; fades when player gains control)
        if (shipPosition && !photosensitive) {
          // Keep circle fully visible during countdown, then fade with GO
          const circleAlpha = state.phase === "countdown" ? 1 : alpha;
          const circleRadius = 25; // Fixed radius around the lander
          const circleYOffset = 4; // Slight downward adjustment to better center on lander
          
          ctx.save();
          ctx.globalAlpha = circleAlpha;
          ctx.strokeStyle = '#00ffff';
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 3]); // Dotted line pattern
          ctx.beginPath();
          ctx.arc(shipPosition.x, shipPosition.y + circleYOffset, circleRadius, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }

        // Warp-in effect for GO phase
        if (state.phase === "go" && state.variant === "warp" && shipPosition) {
          const warpProgress = Math.min(state.timeInPhase / 200, 1);
          
          // Concentric wire rings from ship position
          for (let i = 0; i < (lowGraphics ? 1 : 4); i++) {
            const ringRadius = (50 + i * 30) * warpProgress;
            const ringAlpha = Math.max(0, 1 - warpProgress) * (1 - i * 0.2);
            
            ctx.save();
            ctx.globalAlpha = ringAlpha;
            ctx.strokeStyle = '#00ffff';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(shipPosition.x, shipPosition.y, ringRadius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
          }

          // Ship materialization effect
          if (warpProgress > 0.3) {
            const shipAlpha = (warpProgress - 0.3) / 0.7;
            
            ctx.save();
            ctx.globalAlpha = shipAlpha;
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            
            // Simple ship outline (triangle) - no dashed outline needed since dotted circle handles it
            ctx.beginPath();
            ctx.moveTo(shipPosition.x, shipPosition.y - 10);
            ctx.lineTo(shipPosition.x - 8, shipPosition.y + 8);
            ctx.lineTo(shipPosition.x + 8, shipPosition.y + 8);
            ctx.closePath();
            ctx.stroke();
            
            ctx.fillStyle = '#333333';
            ctx.fill();
            
            // Vertical noise shimmer effect
            if (!lowGraphics && shipAlpha > 0.8) {
              const shimmerRng = mulberry32(mix(0, "SHIMMER", Math.floor(state.timeInPhase * 10)));
              for (let i = 0; i < 5; i++) {
                const offsetY = (shimmerRng() - 0.5) * 4;
                ctx.globalAlpha = 0.3;
                ctx.strokeStyle = '#00ffff';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(shipPosition.x - 10, shipPosition.y + offsetY);
                ctx.lineTo(shipPosition.x + 10, shipPosition.y + offsetY);
                ctx.stroke();
              }
            }
            
            ctx.restore();
          }
        }
      }

      // Continue animation until GO fades out completely (use local timer to ensure fade works even if external state stops updating)
      let continueAnim = false;
      if (state.phase === "countdown") {
        continueAnim = true;
      } else if (state.phase === "go") {
        if (goPhaseStartRef.current == null) {
          goPhaseStartRef.current = performance.now() - state.timeInPhase;
        }
        const goElapsed = performance.now() - goPhaseStartRef.current;
        continueAnim = goElapsed < 600;
      }
      if (continueAnim) {
        rafId = requestAnimationFrame(render);
      } else {
        // Final cleanup - clear entire canvas buffer and reset all state
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.shadowBlur = 0;
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
        // Reset local GO phase timer
        goPhaseStartRef.current = null;
      }
    };

    render();

    return () => {
      if (rafId != null) cancelAnimationFrame(rafId);
      // Ensure full clear on unmount/effect re-run
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.shadowBlur = 0;
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      goPhaseStartRef.current = null;
    };
  }, [state, lowGraphics, photosensitive, shipPosition]);

  if (state.phase === "inactive") {
    return null;
  }

  return (
    <canvas
      ref={overlayCanvasRef}
      className="absolute inset-0 pointer-events-none z-50"
      style={{
        imageRendering: 'pixelated'
      }}
    />
  );
};