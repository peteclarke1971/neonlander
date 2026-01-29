import React, { useEffect, useRef, useState } from "react";

interface SplashScreenProps {
  onComplete: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [fadeOut, setFadeOut] = useState(false);
  const hasCompletedRef = useRef(false);
  
  // Handle completion with fade-out (only fire once)
  const handleComplete = () => {
    if (hasCompletedRef.current) return;
    hasCompletedRef.current = true;
    setFadeOut(true);
    setTimeout(onComplete, 500);
  };
  
  // Handle skip on any input
  useEffect(() => {
    const handleKeyDown = () => handleComplete();
    const handleClick = () => handleComplete();
    const handleTouch = () => handleComplete();
    
    // Poll gamepad for any button
    const handleGamepad = () => {
      const gamepads = navigator.getGamepads();
      for (const gp of gamepads) {
        if (gp && gp.buttons.some(b => b.pressed)) {
          handleComplete();
          break;
        }
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("click", handleClick);
    window.addEventListener("touchstart", handleTouch);
    const gpInterval = setInterval(handleGamepad, 100);
    
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("click", handleClick);
      window.removeEventListener("touchstart", handleTouch);
      clearInterval(gpInterval);
    };
  }, []);
  
  // Auto-complete when video ends
  const handleVideoEnd = () => {
    handleComplete();
  };
  
  return (
    <div 
      className={`fixed inset-0 z-[9999] bg-black flex items-center justify-center transition-opacity duration-500 ${fadeOut ? 'opacity-0' : 'opacity-100'}`}
    >
      <video
        ref={videoRef}
        src="/video/bemoreian-splash.mp4"
        autoPlay
        muted
        playsInline
        onEnded={handleVideoEnd}
        className="max-w-full max-h-full object-contain"
      />
    </div>
  );
};
