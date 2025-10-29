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

  // Handle skip request
  useEffect(() => {
    if (skipRequested) {
      onComplete();
    }
  }, [skipRequested, onComplete]);

  // Early exit if skip requested
  if (skipRequested) {
    return null;
  }

  useEffect(() => {
    if (messages.length === 0) {
      onComplete();
      return;
    }

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
    };
  }, [messages, delayMs]);

  if (currentIndex >= messages.length) {
    return null;
  }

  // Animation calculations
  const t = Math.min(1, animationTime);
  const scaleAmt = 0.85 + Math.sin(Math.PI * t) * 0.6;
  const alpha = 1 - Math.abs(2 * t - 1);

  return (
    <div 
      className="fixed inset-0 pointer-events-none flex items-center justify-center z-50"
      style={{
        transform: `scale(${scaleAmt})`,
        opacity: 0.85 * alpha,
      }}
    >
      <div
        className="text-center font-black text-5xl"
        style={{
          fontFamily: '"Orbitron", sans-serif',
          color: neonColor,
          textShadow: `0 0 28px ${neonColor}, 0 0 56px ${neonColor}`,
          WebkitTextStroke: `2px ${neonColor}`,
          paintOrder: 'stroke fill',
        }}
      >
        {messages[currentIndex]}
      </div>
    </div>
  );
};
