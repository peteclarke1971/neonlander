import { useEffect, useState, useRef, useCallback } from 'react';

interface InFlightTipProps {
  message: string | null;
  neonColor: string;
  duration?: number;
  onComplete: () => void;
}

/**
 * Displays contextual tips during gameplay.
 * Positioned at top-center with fade in/out animation.
 * Auto-dismisses after duration or on any input.
 */
export const InFlightTip = ({ 
  message, 
  neonColor, 
  duration = 4000,
  onComplete 
}: InFlightTipProps) => {
  const [animationTime, setAnimationTime] = useState(0);
  const rafRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const isAnimatingRef = useRef<boolean>(false);
  const onCompleteRef = useRef(onComplete);
  const currentMessageRef = useRef<string | null>(null);
  const dismissedRef = useRef(false);
  const isIPhone = /iPhone/i.test(navigator.userAgent);

  // Keep onComplete ref updated
  onCompleteRef.current = onComplete;

  // Handle early dismissal on any input
  const handleDismiss = useCallback(() => {
    if (message && isAnimatingRef.current && !dismissedRef.current) {
      dismissedRef.current = true;
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      onCompleteRef.current();
    }
  }, [message]);

  // Listen for any input to dismiss
  useEffect(() => {
    if (!message) return;

    const handleKeyDown = () => handleDismiss();
    const handleClick = () => handleDismiss();
    const handleTouch = () => handleDismiss();
    const handleGamepad = () => {
      // Check for any gamepad button press
      const gamepads = navigator.getGamepads?.() || [];
      for (const gp of gamepads) {
        if (gp?.buttons.some(b => b.pressed)) {
          handleDismiss();
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('click', handleClick);
    window.addEventListener('touchstart', handleTouch);
    
    // Poll for gamepad input
    const gamepadInterval = setInterval(handleGamepad, 100);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('click', handleClick);
      window.removeEventListener('touchstart', handleTouch);
      clearInterval(gamepadInterval);
    };
  }, [message, handleDismiss]);

  useEffect(() => {
    // Reset when message changes to a new value
    if (message !== currentMessageRef.current) {
      currentMessageRef.current = message;
      isAnimatingRef.current = false;
      dismissedRef.current = false;
      setAnimationTime(0);
      startTimeRef.current = 0;
      
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    }
    
    if (!message) {
      return;
    }

    // If already animating this message, don't restart
    if (isAnimatingRef.current) {
      return;
    }

    isAnimatingRef.current = true;

    const animate = (timestamp: number) => {
      if (!startTimeRef.current) {
        startTimeRef.current = timestamp;
      }

      const elapsed = timestamp - startTimeRef.current;
      const progress = elapsed / duration;
      
      setAnimationTime(Math.min(1, progress));

      if (progress >= 1) {
        isAnimatingRef.current = false;
        onCompleteRef.current();
        return;
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [message, duration]);

  if (!message) {
    return null;
  }

  // Animation calculations
  const t = Math.min(1, animationTime);
  
  // Fade in for first 10%, hold, fade out for last 15%
  let alpha = 1;
  if (t < 0.1) {
    alpha = t / 0.1; // Fade in
  } else if (t > 0.85) {
    alpha = (1 - t) / 0.15; // Fade out
  }
  
  // Subtle scale effect
  const scaleAmt = 0.95 + Math.min(t * 2, 1) * 0.05; // Scale from 0.95 to 1.0

  // Adjust sizes for iPhone
  const textSize = isIPhone ? 'text-sm' : 'text-base md:text-lg';
  const shadowBlur = isIPhone ? 8 : 12;
  const padding = isIPhone ? 'px-3 py-1.5' : 'px-4 py-2';

  return (
    <div 
      className="fixed inset-x-0 top-[12%] pointer-events-none flex justify-center z-50"
      style={{
        transform: `scale(${scaleAmt})`,
        opacity: 0.95 * alpha,
      }}
    >
      <div
        className={`text-center font-bold ${textSize} tracking-wider ${padding} rounded-lg`}
        style={{
          fontFamily: '"Orbitron", sans-serif',
          color: neonColor,
          textShadow: `0 0 ${shadowBlur * 0.6}px ${neonColor}, 0 0 ${shadowBlur}px ${neonColor}`,
          backgroundColor: 'hsl(var(--background) / 0.7)',
          backdropFilter: 'blur(4px)',
          border: `1px solid ${neonColor}40`,
          maxWidth: '90%',
        }}
      >
        {message}
      </div>
    </div>
  );
};
