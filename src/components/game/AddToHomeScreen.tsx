import React, { useState } from "react";
import { isIOSDevice, isPWA } from "@/lib/deviceDetection";
import { MobileStarfield } from "./MobileStarfield";

const DISMISSED_KEY = 'll-add-to-homescreen-dismissed';

/**
 * Neon-styled prompt encouraging iOS Safari users to add the app to their Home Screen
 * for full-screen PWA experience. Only shows on iOS devices running in Safari (not as PWA).
 * Appears above the PortraitWarning with higher z-index.
 */
export const AddToHomeScreen: React.FC = () => {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISSED_KEY) === 'true';
    } catch {
      return false;
    }
  });
  
  // Only show on iOS devices running in Safari (not PWA)
  const shouldShow = isIOSDevice() && !isPWA() && !dismissed;
  
  const handleDismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISSED_KEY, 'true');
    } catch {}
  };
  
  if (!shouldShow) return null;
  
  const neonGreen = "hsl(120, 100%, 50%)";
  const neonGlow = "0 0 10px hsl(120, 100%, 50%), 0 0 20px hsl(120, 100%, 40%)";
  const subtleGlow = "0 0 8px hsl(120, 100%, 50%)";
  
  // Icon box component for consistent styling
  const IconBox: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <span 
      className="inline-flex items-center justify-center w-7 h-7 mx-1 rounded border font-bold text-base"
      style={{ 
        borderColor: neonGreen,
        color: neonGreen,
        backgroundColor: "hsla(120, 100%, 50%, 0.1)",
        textShadow: subtleGlow
      }}
    >
      {children}
    </span>
  );
  
  return (
    <div 
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
      onClick={handleDismiss}
      style={{ touchAction: 'none' }}
    >
      {/* Mobile Starfield Background */}
      <div className="absolute inset-0 z-0">
        <MobileStarfield starCount={300} speed={0.3} />
      </div>
      
      {/* Content overlay */}
      <div className="relative z-10 text-center max-w-md w-full">
        {/* LANDER Logo */}
        <div className="flex justify-center mb-4">
          <img 
            src="/images/lander-logo.png" 
            alt="LANDER"
            className="w-72 sm:w-[21rem] md:w-96 h-auto select-none pointer-events-none"
            style={{
              filter: "drop-shadow(0 0 20px hsl(120, 100%, 50%))"
            }}
          />
        </div>
        
        {/* Title */}
        <h2 
          className="text-2xl sm:text-3xl font-mono font-bold tracking-wider uppercase mb-4"
          style={{ color: neonGreen, textShadow: neonGlow }}
        >
          INSTALL THE GAME
        </h2>
        
        {/* Subtitle */}
        <p 
          className="text-base sm:text-lg font-mono uppercase mb-6"
          style={{ color: neonGreen, textShadow: subtleGlow }}
        >
          Install on your iPhone or iPad:
        </p>
        
        {/* Step 1 */}
        <div 
          className="rounded-lg p-4 mb-4 border text-left"
          style={{ 
            backgroundColor: "hsla(120, 100%, 50%, 0.08)",
            borderColor: "hsla(120, 100%, 50%, 0.3)"
          }}
        >
          <div className="flex items-start gap-3">
            <span 
              className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-mono font-bold text-lg border"
              style={{ 
                borderColor: neonGreen,
                color: neonGreen,
                backgroundColor: "hsla(120, 100%, 50%, 0.15)",
                textShadow: subtleGlow
              }}
            >
              1
            </span>
            <p 
              className="font-mono text-sm sm:text-base leading-relaxed"
              style={{ color: neonGreen, textShadow: subtleGlow }}
            >
              Tap <IconBox>↑</IconBox> within Safari on iPad or you may need to tap <IconBox>•••</IconBox> on iPhone
            </p>
          </div>
        </div>
        
        {/* Step 2 */}
        <div 
          className="rounded-lg p-4 mb-6 border text-left"
          style={{ 
            backgroundColor: "hsla(120, 100%, 50%, 0.08)",
            borderColor: "hsla(120, 100%, 50%, 0.3)"
          }}
        >
          <div className="flex items-start gap-3">
            <span 
              className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-mono font-bold text-lg border"
              style={{ 
                borderColor: neonGreen,
                color: neonGreen,
                backgroundColor: "hsla(120, 100%, 50%, 0.15)",
                textShadow: subtleGlow
              }}
            >
              2
            </span>
            <p 
              className="font-mono text-sm sm:text-base leading-relaxed"
              style={{ color: neonGreen, textShadow: subtleGlow }}
            >
              Find & tap <IconBox>+</IconBox> "Add to Home Screen"
            </p>
          </div>
        </div>
        
        {/* Footer message */}
        <p 
          className="font-mono text-sm sm:text-base uppercase mb-8 leading-relaxed"
          style={{ color: neonGreen, textShadow: subtleGlow }}
        >
          Launch game from Home Screen for full screen support and best experience
        </p>
        
        {/* Dismiss hint */}
        <p 
          className="text-sm font-mono uppercase animate-pulse"
          style={{ color: "hsl(120, 100%, 40%)" }}
        >
          Tap anywhere to dismiss
        </p>
      </div>
    </div>
  );
};
