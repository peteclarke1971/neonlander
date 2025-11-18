import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { InitialsBadge } from "./InitialsBadge";
import { InitialsFireworks } from "./InitialsFireworks";
import { anyGamepad, loadProfile, readGamepad } from "@/hooks/use-gamepad";

interface Props {
  score: number;
  onSubmit: (initials: string) => void;
  neonColor?: string;
  onInitialsConfirmed?: (initials: string) => void;
}

export const InitialsEntry: React.FC<Props> = ({ 
  score, 
  onSubmit, 
  neonColor, 
  onInitialsConfirmed 
}) => {
  const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!?*._←'.split('');
  
  // Detect touch capability
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  
  // Arcade-style state
  const [initials, setInitials] = useState<string[]>(['', '', '']);
  const [currentSlot, setCurrentSlot] = useState(0);
  const [charIndex, setCharIndex] = useState<number[]>([0, 0, 0]);
  
  // Legacy text input state (for touch devices)
  const [val, setVal] = useState("");
  
  const [showFireworks, setShowFireworks] = useState(false);
  const [confirmedInitials, setConfirmedInitials] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const saveBtnRef = useRef<HTMLButtonElement>(null);
  const lastInputTime = useRef(0);
  
  useEffect(() => { 
    if (isTouchDevice) {
      inputRef.current?.focus(); 
    }
  }, [isTouchDevice]);

  const scrollCharacter = (direction: number) => {
    const now = Date.now();
    if (now - lastInputTime.current < 150) return; // Debounce
    lastInputTime.current = now;
    
    setCharIndex(prev => {
      const newIndex = [...prev];
      newIndex[currentSlot] = (newIndex[currentSlot] + direction + CHARSET.length) % CHARSET.length;
      return newIndex;
    });
  };

  const commitCurrentCharacter = () => {
    const now = Date.now();
    if (now - lastInputTime.current < 200) return; // Debounce
    lastInputTime.current = now;
    
    const char = CHARSET[charIndex[currentSlot]];
    
    if (char === '←') {
      // Backspace: move cursor back
      if (currentSlot > 0) {
        setCurrentSlot(prev => prev - 1);
        setInitials(prev => {
          const newInitials = [...prev];
          newInitials[currentSlot - 1] = '';
          return newInitials;
        });
      }
    } else {
      // Regular character: commit it
      const newInitials = [...initials];
      newInitials[currentSlot] = char;
      setInitials(newInitials);
      
      if (currentSlot === 2) {
        // Third character committed - auto submit!
        handleSubmit(newInitials.join('').replace(/_/g, ' '));
      } else {
        // Move to next slot
        setCurrentSlot(prev => prev + 1);
        // Copy current character index to next slot
        setCharIndex(prev => {
          const newIndex = [...prev];
          newIndex[currentSlot + 1] = newIndex[currentSlot];
          return newIndex;
        });
      }
    }
  };

  const handleSubmit = (finalInitials: string) => {
    if (finalInitials.length === 0) return;
    
    // If onInitialsConfirmed and neonColor provided, show fireworks first
    if (onInitialsConfirmed && neonColor) {
      setConfirmedInitials(finalInitials);
      setShowFireworks(true);
    } else {
      // Backward compatible: immediate submit
      onSubmit(finalInitials);
    }
  };

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const processedInitials = val.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3);
    if (processedInitials.length === 0) return;
    handleSubmit(processedInitials);
  };

  const handleFireworksComplete = () => {
    setShowFireworks(false);
    if (onInitialsConfirmed) {
      onInitialsConfirmed(confirmedInitials);
    }
  };

  const handleFireworksSkip = () => {
    handleFireworksComplete();
  };

  // Keyboard handler for arcade-style input
  useEffect(() => {
    if (isTouchDevice) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        scrollCharacter(-1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        scrollCharacter(1);
      } else if (e.key === 'ArrowUp' || e.key === 'Enter') {
        e.preventDefault();
        commitCurrentCharacter();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentSlot, charIndex, initials, isTouchDevice]);

  // Gamepad handler for arcade-style input
  useEffect(() => {
    if (isTouchDevice) return;
    
    const gamepadInterval = setInterval(() => {
      const gp = anyGamepad();
      if (!gp) return;
      
      const profile = loadProfile(gp.id);
      const input = readGamepad(gp, profile);
      
      // Rotation for scrolling
      if (input.rotation < -0.5) {
        scrollCharacter(-1);
      } else if (input.rotation > 0.5) {
        scrollCharacter(1);
      }
      
      // Thrust to commit
      if (input.thrust > 0.5) {
        commitCurrentCharacter();
      }
    }, 50);
    
    return () => clearInterval(gamepadInterval);
  }, [currentSlot, charIndex, initials, isTouchDevice]);

  const handleKeyDownLegacy: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
    const key = e.key;
    if (key === "ArrowRight") {
      e.preventDefault();
      saveBtnRef.current?.focus();
    } else if (key === "ArrowLeft") {
      e.preventDefault();
      inputRef.current?.focus();
    } else if (key === "Enter") {
      // Let focused element handle Enter (form submit or button click)
    }
  };

  const currentChar = CHARSET[charIndex[currentSlot]];
  const prevChar = CHARSET[(charIndex[currentSlot] - 1 + CHARSET.length) % CHARSET.length];
  const nextChar = CHARSET[(charIndex[currentSlot] + 1) % CHARSET.length];

  return (
    <>
      {showFireworks && neonColor ? (
        <InitialsFireworks
          initials={confirmedInitials}
          neonColor={neonColor}
          onComplete={handleFireworksComplete}
          onSkip={handleFireworksSkip}
        />
      ) : isTouchDevice ? (
        // Legacy text input for touch devices
        <div className="mt-6 p-4 bg-card/70 border border-border/60 rounded-lg backdrop-blur-sm animate-enter" onKeyDown={handleKeyDownLegacy}>
          <div className="text-sm uppercase tracking-wide text-muted-foreground">New High Score</div>
          <div className="mt-1 text-2xl font-bold">{score}</div>
          <form onSubmit={submit} className="mt-4 flex items-center gap-4">
            <InitialsBadge initials={val.toUpperCase()} />
            <input
              ref={inputRef}
              type="text"
              maxLength={3}
              placeholder="Enter initials"
              value={val}
              onChange={(e) => setVal(e.target.value.toUpperCase())}
              className="bg-background/60 border border-border/60 rounded-md px-3 py-2 w-36 text-center tracking-widest font-mono text-lg outline-none focus:ring-2 focus:ring-[hsl(var(--neon))]"
            />
            <Button ref={saveBtnRef} variant="neon" type="submit">Save</Button>
          </form>
        </div>
      ) : (
        // Arcade-style character carousel for keyboard/gamepad
        <div className="mt-6 p-4 bg-card/70 border border-border/60 rounded-lg backdrop-blur-sm animate-enter">
          <div className="text-sm uppercase tracking-wide text-muted-foreground">New High Score</div>
          <div className="mt-1 text-2xl font-bold">{score}</div>
          
          <div className="mt-6 flex flex-col items-center gap-4">
            {/* Initials Badge */}
            <InitialsBadge initials={initials.map((c, i) => c || (i === currentSlot ? currentChar : '·')).join('')} />
            
            {/* Character Selector with Preview */}
            <div className="flex items-center gap-4 font-mono">
              <span className="text-2xl text-muted-foreground/40">{prevChar}</span>
              <div className="text-6xl font-bold" style={{ 
                color: neonColor || 'hsl(var(--neon))',
                textShadow: `0 0 20px ${neonColor || 'hsl(var(--neon))'}`,
                filter: 'drop-shadow(0 0 10px currentColor)'
              }}>
                {currentChar}
              </div>
              <span className="text-2xl text-muted-foreground/40">{nextChar}</span>
            </div>
            
            {/* Slot Indicators */}
            <div className="flex gap-3">
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  className="w-12 h-12 rounded border-2 flex items-center justify-center font-mono text-lg transition-all"
                  style={{
                    borderColor: i === currentSlot ? (neonColor || 'hsl(var(--neon))') : 'hsl(var(--border))',
                    backgroundColor: i === currentSlot 
                      ? `${neonColor || 'hsl(var(--neon))'}15`
                      : 'transparent',
                    animation: i === currentSlot ? 'pulse-slot 1.5s ease-in-out infinite' : 'none',
                  }}
                >
                  {initials[i] || ''}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      <style>{`
        @keyframes pulse-slot {
          0%, 100% { 
            box-shadow: 0 0 10px ${neonColor || 'hsl(var(--neon))'}40;
          }
          50% { 
            box-shadow: 0 0 20px ${neonColor || 'hsl(var(--neon))'}80;
          }
        }
      `}</style>
    </>
  );
};
