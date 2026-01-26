import { useEffect, useState, useRef } from 'react';

interface SectorMessageDisplayProps {
  message: string | null;
  neonColor: string;
  onComplete: () => void;
}

/**
 * Displays sector milestone names during survival mode gameplay.
 * Positioned higher on screen with subtler styling than bonus messages.
 */
export const SectorMessageDisplay = ({ 
  message, 
  neonColor, 
  onComplete 
}: SectorMessageDisplayProps) => {
  const [animationTime, setAnimationTime] = useState(0);
  const rafRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const isAnimatingRef = useRef<boolean>(false);
  const isIPhone = /iPhone/i.test(navigator.userAgent);

  useEffect(() => {
    // Reset when message changes
    if (!message) {
      isAnimatingRef.current = false;
      setAnimationTime(0);
      return;
    }

    // If already animating same message, don't restart
    if (isAnimatingRef.current) {
      return;
    }

    isAnimatingRef.current = true;
    startTimeRef.current = 0;

    const MESSAGE_DURATION = 1500; // 1.5 seconds (shorter than bonus messages)

    const animate = (timestamp: number) => {
      if (!startTimeRef.current) {
        startTimeRef.current = timestamp;
      }

      const elapsed = timestamp - startTimeRef.current;
      const progress = elapsed / MESSAGE_DURATION;
      
      setAnimationTime(Math.min(1, progress));

      if (progress >= 1) {
        isAnimatingRef.current = false;
        onComplete();
        return;
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      isAnimatingRef.current = false;
    };
  }, [message, onComplete]);

  if (!message) {
    return null;
  }

  // Animation calculations - subtler than bonus messages
  const t = Math.min(1, animationTime);
  const scaleAmt = 0.92 + Math.sin(Math.PI * t) * 0.12; // 0.92 to 1.04 (subtle)
  const alpha = 1 - Math.abs(2 * t - 1); // Fade in then out

  // Adjust sizes for iPhone
  const textSize = isIPhone ? 'text-lg' : 'text-2xl md:text-3xl';
  const shadowBlur = isIPhone ? 10 : 18;

  return (
    <div 
      className="fixed inset-x-0 top-[18%] pointer-events-none flex justify-center z-40"
      style={{
        transform: `scale(${scaleAmt})`,
        opacity: 0.8 * alpha,
      }}
    >
      <div
        className={`text-center font-bold ${textSize} tracking-[0.15em]`}
        style={{
          fontFamily: '"Orbitron", sans-serif',
          color: neonColor,
          textShadow: `0 0 ${shadowBlur * 0.6}px ${neonColor}, 0 0 ${shadowBlur * 1.2}px ${neonColor}`,
        }}
      >
        {message}
      </div>
    </div>
  );
};
