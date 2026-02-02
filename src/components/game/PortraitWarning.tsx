import React, { useState, useEffect } from "react";

interface Props {
  onDismiss?: () => void;
}

export const PortraitWarning: React.FC<Props> = ({ onDismiss }) => {
  const [isPortrait, setIsPortrait] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  
  // Check for iPhone (not iPad)
  const isIPhone = typeof navigator !== 'undefined' && /iPhone/i.test(navigator.userAgent);
  
  useEffect(() => {
    if (!isIPhone) {
      console.log('PortraitWarning: Not iPhone, skipping. UA:', navigator.userAgent);
      return;
    }
    
    console.log('PortraitWarning: iPhone detected, monitoring orientation');
    
    const checkOrientation = () => {
      const isNowPortrait = window.innerHeight > window.innerWidth;
      console.log('PortraitWarning: Orientation check -', isNowPortrait ? 'PORTRAIT' : 'LANDSCAPE', 
        `(${window.innerWidth}x${window.innerHeight})`);
      setIsPortrait(isNowPortrait);
      // Auto-reset dismissed state when rotating to landscape and back
      if (!isNowPortrait) setDismissed(false);
    };
    
    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
    
    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, [isIPhone]);
  
  if (!isIPhone || !isPortrait || dismissed) return null;
  
  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/95 backdrop-blur-md"
      onClick={() => { setDismissed(true); onDismiss?.(); }}
      style={{ touchAction: 'none' }}
    >
      <div className="text-center px-8">
        <div className="text-6xl mb-6">📱↔️</div>
        <h2 className="text-2xl font-bold text-accent mb-3 tracking-wide">
          Game played best in LANDSCAPE mode
        </h2>
        <p className="text-lg text-muted-foreground mb-4">
          Please rotate your device
        </p>
        <p className="text-sm text-muted-foreground/60 animate-pulse">
          Tap anywhere to dismiss
        </p>
      </div>
    </div>
  );
};
