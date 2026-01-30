import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GuidePageControls } from './guide/GuidePageControls';
import { GuidePageLanding } from './guide/GuidePageLanding';
import { GuidePageFuelShields } from './guide/GuidePageFuelShields';
import { GuidePageHazards } from './guide/GuidePageHazards';
import { GuidePageScoring } from './guide/GuidePageScoring';
import { GuidePageModes } from './guide/GuidePageModes';
import { GuidePageSurvival } from './guide/GuidePageSurvival';
import { anyGamepad, loadProfile, readGamepad, vibrate, getLastDeviceId } from '@/hooks/use-gamepad';

interface GuidePopupProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenChange?: (isOpen: boolean) => void;
}

const PAGES = [
  { id: 'controls', title: 'CONTROLS', Component: GuidePageControls },
  { id: 'landing', title: 'LANDING', Component: GuidePageLanding },
  { id: 'fuel', title: 'FUEL & SHIELDS', Component: GuidePageFuelShields },
  { id: 'hazards', title: 'HAZARDS', Component: GuidePageHazards },
  { id: 'scoring', title: 'SCORING', Component: GuidePageScoring },
  { id: 'modes', title: 'GAME MODES', Component: GuidePageModes },
  { id: 'survival', title: 'SURVIVAL', Component: GuidePageSurvival },
];

export const GuidePopup: React.FC<GuidePopupProps> = ({ isOpen, onClose, onOpenChange }) => {
  const [currentPage, setCurrentPage] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const gpPrevRef = useRef({ left: false, right: false, back: false, select: false });
  const gpLastFireRef = useRef({ left: 0, right: 0, back: 0, select: 0 });

  // Always start at first page when opening
  useEffect(() => {
    if (isOpen) {
      setCurrentPage(0);
    }
  }, [isOpen]);

  // Notify parent of open state changes
  useEffect(() => {
    onOpenChange?.(isOpen);
  }, [isOpen, onOpenChange]);

  // Auto-scroll feature with smooth interpolation (includes scroll-to-top)
  useEffect(() => {
    if (!isOpen) return;
    
    const container = scrollContainerRef.current;
    if (!container) return;
    
    // Reset scroll to top immediately when page changes
    container.scrollTop = 0;
    
    // Track cleanup resources at effect level
    let rafId = 0;
    let resetAutoScroll: (() => void) | null = null;
    let cancelled = false;
    
    // Longer delay to let content fully render before checking scroll
    const checkTimeout = setTimeout(() => {
      if (cancelled || !scrollContainerRef.current) return;
      
      const hasScroll = container.scrollHeight > container.clientHeight;
      if (!hasScroll) return;
      
      const SCROLL_SPEED = 25; // pixels per second (base speed)
      const WAIT_TIME = 3000; // 3 seconds
      const SMOOTHING = 0.92; // Higher = smoother (0.9-0.98 range)
      
      let lastTime = performance.now();
      let direction: 'down' | 'up' | 'waiting' = 'waiting';
      let waitStart = performance.now();
      let userInteracted = false;
      let currentVelocity = 0; // Smoothed velocity
      
      resetAutoScroll = () => {
        userInteracted = true;
        waitStart = performance.now();
        direction = 'waiting';
        currentVelocity = 0; // Reset velocity on interaction
        // Resume after 3 seconds of no interaction
        setTimeout(() => { userInteracted = false; }, 3000);
      };
      
      container.addEventListener('touchstart', resetAutoScroll, { passive: true });
      container.addEventListener('wheel', resetAutoScroll, { passive: true });
      
      const animate = (time: number) => {
        if (cancelled) return; // Stop if effect was cleaned up
        
        const delta = Math.min(time - lastTime, 50); // Cap delta to prevent jumps
        lastTime = time;
        
        if (userInteracted) {
          currentVelocity = 0;
          rafId = requestAnimationFrame(animate);
          return;
        }
        
        const { scrollTop, scrollHeight, clientHeight } = container;
        const maxScroll = scrollHeight - clientHeight;
        
        let targetVelocity = 0;
        
        if (direction === 'waiting') {
          if (time - waitStart >= WAIT_TIME) {
            if (scrollTop >= maxScroll - 1) {
              direction = 'up';
            } else {
              direction = 'down';
            }
          }
        } else if (direction === 'down') {
          targetVelocity = SCROLL_SPEED;
          if (scrollTop >= maxScroll - 1) {
            direction = 'waiting';
            waitStart = time;
            targetVelocity = 0;
          }
        } else if (direction === 'up') {
          targetVelocity = -SCROLL_SPEED;
          if (scrollTop <= 1) {
            direction = 'waiting';
            waitStart = time;
            targetVelocity = 0;
          }
        }
        
        // Smooth interpolation of velocity
        currentVelocity = currentVelocity * SMOOTHING + targetVelocity * (1 - SMOOTHING);
        
        // Apply smoothed scroll
        if (Math.abs(currentVelocity) > 0.1) {
          container.scrollTop += currentVelocity * delta / 1000;
        }
        
        rafId = requestAnimationFrame(animate);
      };
      
      rafId = requestAnimationFrame(animate);
    }, 300); // Increased delay for content to render
    
    // Proper cleanup at effect level
    return () => {
      cancelled = true;
      clearTimeout(checkTimeout);
      cancelAnimationFrame(rafId);
      if (resetAutoScroll && container) {
        container.removeEventListener('touchstart', resetAutoScroll);
        container.removeEventListener('wheel', resetAutoScroll);
      }
    };
  }, [isOpen, currentPage]);

  const goToPrevPage = useCallback(() => {
    setCurrentPage(p => Math.max(0, p - 1));
  }, []);

  const goToNextPage = useCallback(() => {
    setCurrentPage(p => Math.min(PAGES.length - 1, p + 1));
  }, []);

  // Keyboard navigation - use capture phase to intercept before game
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        e.stopPropagation();
        goToPrevPage();
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        e.stopPropagation();
        goToNextPage();
      }
    };

    // Use capture phase to handle events before other listeners
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, onClose, goToPrevPage, goToNextPage]);

  // Gamepad navigation
  useEffect(() => {
    if (!isOpen) return;

    let raf = 0;
    let lastId: string | null = getLastDeviceId();
    let profile = loadProfile(lastId || undefined);
    
    const canFire = (dir: keyof typeof gpLastFireRef.current) => 
      performance.now() - gpLastFireRef.current[dir] > 200;
    const mark = (dir: keyof typeof gpLastFireRef.current) => { 
      gpLastFireRef.current[dir] = performance.now(); 
    };

    const loop = () => {
      raf = requestAnimationFrame(loop);
      const gp = anyGamepad?.();
      if (!gp || !gp.connected) return;
      
      if (lastId !== gp.id) {
        lastId = gp.id;
        profile = loadProfile(gp.id);
      }
      
      const input = readGamepad(gp, profile);
      const prev = gpPrevRef.current;

      // D-pad left/right for page navigation
      if (input.ui.left && !prev.left && canFire('left')) {
        goToPrevPage();
        vibrate(30, 0.15, 0.3);
        mark('left');
      }
      if (input.ui.right && !prev.right && canFire('right')) {
        goToNextPage();
        vibrate(30, 0.15, 0.3);
        mark('right');
      }
      
      // Back button to close
      if (input.ui.back && !prev.back && canFire('back')) {
        onClose();
        vibrate(40, 0.2, 0.4);
        mark('back');
      }

      gpPrevRef.current = { 
        left: input.ui.left, 
        right: input.ui.right, 
        back: input.ui.back,
        select: input.ui.select 
      };
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [isOpen, onClose, goToPrevPage, goToNextPage]);

  // Touch swipe handling
  const touchStartX = useRef<number | null>(null);
  
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX;
    const threshold = 50;

    if (Math.abs(diff) > threshold) {
      if (diff > 0) {
        goToNextPage();
      } else {
        goToPrevPage();
      }
    }
    
    touchStartX.current = null;
  };

  if (!isOpen) return null;

  const CurrentPageComponent = PAGES[currentPage].Component;

  return (
    <div 
      className="absolute inset-0 z-30 flex items-center justify-center bg-background/80 backdrop-blur-sm"
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div 
        className="flex flex-col w-full max-w-lg mx-4 max-h-[85vh] border-2 rounded-lg bg-background/95 overflow-hidden"
        style={{ borderColor: 'hsl(var(--neon) / 0.5)' }}
      >
        {/* Header */}
        <div 
          className="flex items-center justify-between px-4 py-3 border-b"
          style={{ borderColor: 'hsl(var(--neon) / 0.3)' }}
        >
          <button
            className="text-sm opacity-60 hover:opacity-100 transition-opacity disabled:opacity-20"
            onClick={goToPrevPage}
            disabled={currentPage === 0}
            style={{ color: 'hsl(var(--neon))' }}
          >
            ← PREV
          </button>
          
          <h2 
            className="text-center text-base font-display tracking-wider"
            style={{ 
              color: 'hsl(var(--neon))',
              textShadow: '0 0 10px hsl(var(--neon) / 0.5)'
            }}
          >
            {PAGES[currentPage].title}
          </h2>
          
          <button
            className="text-sm opacity-60 hover:opacity-100 transition-opacity disabled:opacity-20"
            onClick={goToNextPage}
            disabled={currentPage === PAGES.length - 1}
            style={{ color: 'hsl(var(--neon))' }}
          >
            NEXT →
          </button>
        </div>

        {/* Content */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4 guide-scroll">
          <CurrentPageComponent />
        </div>

        {/* Footer with page indicators and close button */}
        <div 
          className="flex flex-col gap-3 px-4 py-3 border-t"
          style={{ borderColor: 'hsl(var(--neon) / 0.3)' }}
        >
          {/* Page indicator dots */}
          <div className="flex justify-center gap-1.5">
            {PAGES.map((_, i) => (
              <button
                key={i}
                className="w-2 h-2 rounded-full transition-all duration-300"
                onClick={() => setCurrentPage(i)}
                style={{ 
                  backgroundColor: i === currentPage 
                    ? 'hsl(var(--neon))' 
                    : 'hsl(var(--neon) / 0.3)',
                  boxShadow: i === currentPage ? '0 0 6px hsl(var(--neon))' : 'none'
                }}
              />
            ))}
          </div>
          
          {/* Close button */}
          <button
            className="player-menu-back-btn w-full"
            onClick={onClose}
          >
            ← CLOSE GUIDE
          </button>
        </div>
      </div>
    </div>
  );
};
