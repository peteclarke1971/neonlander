import { useEffect, useState, useRef } from 'react';

interface BonusMessageDisplayProps {
  messages: string[];
  neonColor: string;
  delayMs: number;
  onComplete: () => void;
  skipRequested?: boolean;
}

export const BonusMessageDisplay = ({ 
  messages, 
  neonColor, 
  delayMs,
  onComplete,
  skipRequested = false
}: BonusMessageDisplayProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [animationTime, setAnimationTime] = useState(0);
  const rafRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const messageStartTimeRef = useRef<number>(0);
  const isAnimatingRef = useRef<boolean>(false);
  const isIPhone = /iPhone/i.test(navigator.userAgent);

  // Handle skip request
  useEffect(() => {
    if (skipRequested) {
      isAnimatingRef.current = false;
      onComplete();
    }
  }, [skipRequested, onComplete]);

  // Early exit if skip requested
  if (skipRequested) {
    return null;
  }

  useEffect(() => {
    // If already animating, don't restart
    if (isAnimatingRef.current) {
      return;
    }

    if (messages.length === 0) {
      onComplete();
      return;
    }

    // Mark as animating
    isAnimatingRef.current = true;

    const MESSAGE_DURATION = 2000; // 2 seconds per message
    let animationStarted = false;

    const animate = (timestamp: number) => {
      if (!startTimeRef.current) {
        startTimeRef.current = timestamp;
      }

      const elapsed = timestamp - startTimeRef.current;

      // Wait for initial delay
      if (!animationStarted && elapsed >= delayMs) {
        animationStarted = true;
        messageStartTimeRef.current = timestamp;
      }

      if (animationStarted) {
        const messageElapsed = timestamp - messageStartTimeRef.current;
        const messageIndex = Math.floor(messageElapsed / MESSAGE_DURATION);

        // Update current message index
        if (messageIndex < messages.length && messageIndex !== currentIndex) {
          setCurrentIndex(messageIndex);
          messageStartTimeRef.current = timestamp;
        }

        // Update animation time for current message
        const currentMessageTime = timestamp - messageStartTimeRef.current;
        setAnimationTime(currentMessageTime / MESSAGE_DURATION);

        // Check if all messages shown
        if (messageIndex >= messages.length) {
          isAnimatingRef.current = false;
          onComplete();
          return;
        }
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
  }, [messages, delayMs]);

  if (currentIndex >= messages.length) {
    return null;
  }

  // Animation calculations
  const t = Math.min(1, animationTime);
  const scaleAmt = 0.85 + Math.sin(Math.PI * t) * 0.6;
  const alpha = 1 - Math.abs(2 * t - 1);

  // Adjust sizes for iPhone
  const textSize = isIPhone ? 'text-2xl' : 'text-5xl';
  const shadowBlur = isIPhone ? 14 : 28;

  return (
    <div 
      className="fixed inset-0 pointer-events-none flex items-center justify-center z-50"
      style={{
        transform: `scale(${scaleAmt})`,
        opacity: 0.85 * alpha,
      }}
    >
      <div
        className={`text-center font-bold ${textSize}`}
        style={{
          fontFamily: '"Orbitron", sans-serif',
          color: neonColor,
          textShadow: `0 0 ${shadowBlur * 0.7}px ${neonColor}, 0 0 ${shadowBlur * 1.4}px ${neonColor}`,
        }}
      >
        {messages[currentIndex]}
      </div>
    </div>
  );
};
