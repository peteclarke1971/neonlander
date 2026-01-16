import React, { useEffect, useRef, useState } from "react";
import { HomeStarfield } from "./HomeStarfield";
import { anyGamepad, loadProfile, readGamepad, gateThrustUntilRelease, setUiMode } from "@/hooks/use-gamepad";

interface PlayerMenuProps {
  onStartGame: () => void;
  onGameModes: () => void;
  onLeaderboards: () => void;
  onSettings: () => void;
  onDevPortal: () => void;
}

const menuItems = [
  { id: "start", label: "START GAME" },
  { id: "modes", label: "GAME MODES" },
  { id: "leaderboards", label: "LEADERBOARDS" },
  { id: "settings", label: "SETTINGS" },
] as const;

export const PlayerMenu: React.FC<PlayerMenuProps> = ({
  onStartGame,
  onGameModes,
  onLeaderboards,
  onSettings,
  onDevPortal,
}) => {
  const [focusedIndex, setFocusedIndex] = useState(0);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Focus management
  useEffect(() => {
    buttonRefs.current[focusedIndex]?.focus();
  }, [focusedIndex]);

  // Auto-focus first button on mount
  useEffect(() => {
    buttonRefs.current[0]?.focus();
  }, []);

  // Set UI mode for gamepad thrust gating
  useEffect(() => {
    try {
      setUiMode(true);
    } catch {}
    return () => {
      try {
        setUiMode(false);
      } catch {}
    };
  }, []);

  // Gamepad navigation
  useEffect(() => {
    let raf = 0;
    let lastId: string | null = null;
    try {
      lastId = localStorage.getItem("ll-gp-last-device");
    } catch {}
    let profile = loadProfile(lastId || undefined);
    let prev = { up: false, down: false, select: false, back: false };
    let lastFire = { up: 0, down: 0, select: 0, back: 0 };
    const canFire = (dir: keyof typeof lastFire) => performance.now() - lastFire[dir] > 140;
    const mark = (dir: keyof typeof lastFire) => { lastFire[dir] = performance.now(); };

    const loop = () => {
      raf = requestAnimationFrame(loop);
      const gp = anyGamepad?.();
      if (!gp || !gp.connected) return;
      if (lastId !== gp.id) {
        lastId = gp.id;
        profile = loadProfile(gp.id);
      }
      const input = readGamepad(gp, profile);
      
      if (input.ui.up && !prev.up && canFire("up")) {
        setFocusedIndex(i => Math.max(0, i - 1));
        mark("up");
      }
      if (input.ui.down && !prev.down && canFire("down")) {
        setFocusedIndex(i => Math.min(menuItems.length - 1, i + 1));
        mark("down");
      }
      if (input.ui.select && !prev.select && canFire("select")) {
        buttonRefs.current[focusedIndex]?.click();
        gateThrustUntilRelease();
        mark("select");
      }
      if (input.ui.back && !prev.back && canFire("back")) {
        onDevPortal();
        mark("back");
      }
      prev = { up: input.ui.up, down: input.ui.down, select: input.ui.select, back: input.ui.back };
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [focusedIndex, onDevPortal]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIndex(i => Math.max(0, i - 1));
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedIndex(i => Math.min(menuItems.length - 1, i + 1));
    } else if (e.key === "Escape") {
      e.preventDefault();
      onDevPortal();
    }
  };

  const handleAction = (id: string) => {
    switch (id) {
      case "start": onStartGame(); break;
      case "modes": onGameModes(); break;
      case "leaderboards": onLeaderboards(); break;
      case "settings": onSettings(); break;
    }
  };

  return (
    <main
      className="fixed inset-0 bg-background overflow-hidden flex items-center justify-center"
      onKeyDown={handleKeyDown}
    >
      {/* Starfield background */}
      <HomeStarfield />
      
      {/* Subtle gradient overlay */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at center, transparent 0%, hsl(var(--background)) 70%)"
        }}
      />

      {/* Main content - responsive sizing for mobile */}
      <section className="relative z-10 flex flex-col items-center gap-4 sm:gap-6 md:gap-8 px-4 py-4 max-h-[100dvh] overflow-y-auto">
        {/* LANDER Logo - scales down for mobile/landscape */}
        <h1 className="player-menu-logo text-4xl sm:text-5xl md:text-6xl lg:text-8xl font-bold tracking-[0.12em] sm:tracking-[0.15em] select-none">
          L<span className="player-menu-lander-a">▲</span>NDER
        </h1>

        {/* Menu buttons - tighter spacing on mobile */}
        <nav className="flex flex-col gap-2 sm:gap-3 md:gap-4 w-full max-w-xs">
          {menuItems.map((item, index) => (
            <button
              key={item.id}
              ref={el => { buttonRefs.current[index] = el; }}
              className="player-menu-btn"
              onClick={() => handleAction(item.id)}
              onFocus={() => setFocusedIndex(index)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </section>

      {/* Dev Portal link - bottom right */}
      <footer className="absolute bottom-4 right-4 flex items-center gap-2 z-10">
        <button
          className="text-xs uppercase tracking-widest opacity-30 hover:opacity-60 transition-opacity"
          onClick={onDevPortal}
          style={{ color: "hsl(var(--neon))" }}
        >
          Dev Portal
        </button>
        <span 
          className="text-sm opacity-30"
          style={{ color: "hsl(var(--neon))" }}
        >
          ✦
        </span>
      </footer>
    </main>
  );
};

export default PlayerMenu;
