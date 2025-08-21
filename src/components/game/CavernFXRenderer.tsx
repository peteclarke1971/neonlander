import React, { useEffect, useRef, useCallback } from 'react';
import { cavernFX, CavernFXParams } from './systems/cavernFX';
import { CavernBakeResult } from './systems/cavernBake';

interface CavernFXRendererProps {
  cavernData: CavernBakeResult | null;
  enabled: boolean;
  cameraX: number;
  cameraY: number;
  viewWidth: number;
  viewHeight: number;
  params?: Partial<CavernFXParams>;
  className?: string;
}

export const CavernFXRenderer: React.FC<CavernFXRendererProps> = ({
  cavernData,
  enabled,
  cameraX,
  cameraY,
  viewWidth,
  viewHeight,
  params,
  className = ""
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();
  const lastTimeRef = useRef<number>(performance.now());

  // Initialize WebGL context and CavernFX system
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const success = cavernFX.initialize(canvas);
    if (!success) {
      console.warn('CavernFX: Failed to initialize WebGL');
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      cavernFX.stop(0);
    };
  }, []);

  // Start/stop effects based on enabled state and cavern data
  useEffect(() => {
    if (enabled && cavernData && canvasRef.current) {
      cavernFX.play(cavernData, params);
    } else {
      cavernFX.stop(0.3);
    }
  }, [enabled, cavernData, params]);

  // Animation loop
  const animate = useCallback((currentTime: number) => {
    const deltaTime = currentTime - lastTimeRef.current;
    lastTimeRef.current = currentTime;

    if (enabled && cavernData && canvasRef.current) {
      cavernFX.update(deltaTime);
      cavernFX.render(canvasRef.current, cameraX, cameraY, viewWidth, viewHeight);
    }

    animationFrameRef.current = requestAnimationFrame(animate);
  }, [enabled, cavernData, cameraX, cameraY, viewWidth, viewHeight]);

  // Start animation loop
  useEffect(() => {
    animationFrameRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [animate]);

  // Handle canvas resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const updateCanvasSize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const parent = canvas.parentElement as HTMLElement | null;
      const width = parent?.clientWidth || canvas.clientWidth || window.innerWidth;
      const height = parent?.clientHeight || canvas.clientHeight || window.innerHeight;

      const targetW = Math.max(1, Math.floor(width * dpr));
      const targetH = Math.max(1, Math.floor(height * dpr));

      if (canvas.width !== targetW) canvas.width = targetW;
      if (canvas.height !== targetH) canvas.height = targetH;

      // Fill parent via CSS (avoid locking to stale rects)
      canvas.style.width = '100%';
      canvas.style.height = '100%';
    };

    updateCanvasSize();

    const resizeObserver = new ResizeObserver(updateCanvasSize);
    if (canvas.parentElement) {
      resizeObserver.observe(canvas.parentElement);
    } else {
      resizeObserver.observe(canvas);
    }

    const onWindowResize = () => updateCanvasSize();
    window.addEventListener('resize', onWindowResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', onWindowResize);
    };
  }, []);

  if (!enabled) {
    return null;
  }

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 pointer-events-none z-10 ${className}`}
      style={{
        mixBlendMode: 'screen', // Blend with background
        opacity: enabled ? 1 : 0,
        transition: 'opacity 0.3s ease-in-out'
      }}
    />
  );
};