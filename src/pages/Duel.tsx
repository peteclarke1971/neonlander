import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { DuelEngine } from "@/engine/duel/DuelEngine";
import { anyGamepad, readGamepad, loadProfile } from "@/hooks/use-gamepad";

export interface DuelOptions {
  seed: number;
  wrap: boolean;
  hazards: boolean;
}

export default function Duel() {
  const navigate = useNavigate();
  const [gameStarted, setGameStarted] = useState(false);
  const [options, setOptions] = useState<DuelOptions>({
    seed: Math.floor(Math.random() * 1000000),
    wrap: false,
    hazards: true,
  });

  const seedInputRef = useRef<HTMLInputElement>(null);
  const startBtnRef = useRef<HTMLButtonElement>(null);
  const backBtnRef = useRef<HTMLButtonElement>(null);

  // Focus start button on mount
  useEffect(() => {
    startBtnRef.current?.focus();
  }, []);

  // Gamepad navigation
  useEffect(() => {
    let raf = 0;
    let lastId: string | null = null;
    let profile = loadProfile(undefined);
    let prev = { up: false, down: false, left: false, right: false, select: false, back: false };

    const fire = (key: string) => {
      const target = (document.activeElement as HTMLElement) || document.body;
      if (!target || target === document.body) {
        startBtnRef.current?.focus();
      }
      const dispatchTarget = (document.activeElement as HTMLElement) || document.body;
      dispatchTarget.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
      if (key === "Enter") {
        dispatchTarget.dispatchEvent(new KeyboardEvent("keyup", { key, bubbles: true }));
        try { (dispatchTarget as any)?.click?.(); } catch {}
      }
    };

    const loop = () => {
      raf = requestAnimationFrame(loop);
      const gp = anyGamepad?.();
      if (!gp || !gp.connected || gameStarted) return;
      
      if (lastId !== gp.id) {
        lastId = gp.id;
        profile = loadProfile(gp.id);
      }
      
      const input = readGamepad(gp, profile);
      if (input.ui.up && !prev.up) fire("ArrowUp");
      if (input.ui.down && !prev.down) fire("ArrowDown");
      if (input.ui.left && !prev.left) fire("ArrowLeft");
      if (input.ui.right && !prev.right) fire("ArrowRight");
      if (input.ui.select && !prev.select) fire("Enter");
      if (input.ui.back && !prev.back) fire("Escape");
      prev = input.ui;
    };
    
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [gameStarted]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (gameStarted) return;
    
    const key = e.key;
    if (key === "Escape") {
      navigate("/");
      return;
    }
    
    if (!(key === "ArrowUp" || key === "ArrowDown")) return;
    e.preventDefault();
    
    const active = document.activeElement as HTMLElement | null;
    const focus = (el?: HTMLElement | null) => el && el.focus();
    
    if (active === startBtnRef.current) {
      if (key === "ArrowDown") focus(backBtnRef.current);
    } else if (active === backBtnRef.current) {
      if (key === "ArrowUp") focus(startBtnRef.current);
    }
  };

  const handleStartMatch = () => {
    setGameStarted(true);
  };

  const handleMatchEnd = () => {
    setGameStarted(false);
  };

  const generateNewSeed = () => {
    const newSeed = Math.floor(Math.random() * 1000000);
    setOptions(prev => ({ ...prev, seed: newSeed }));
  };

  if (gameStarted) {
    return (
      <DuelEngine 
        options={options} 
        onMatchEnd={handleMatchEnd}
      />
    );
  }

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-4" onKeyDown={handleKeyDown}>
      <Card className="w-full max-w-2xl border-border bg-card/80 backdrop-blur-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-4xl font-display tracking-wider text-foreground drop-shadow-[0_0_18px_hsla(var(--neon),_0.5)]">
            LANDER DUEL
          </CardTitle>
          <p className="text-muted-foreground">
            Two-player arena combat using classic Lander physics. First to 2 round wins!
          </p>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Arena Seed */}
          <div className="space-y-2">
            <Label htmlFor="seed">Arena Seed</Label>
            <div className="flex gap-2">
              <Input
                id="seed"
                ref={seedInputRef}
                type="number"
                value={options.seed}
                onChange={(e) => setOptions(prev => ({ 
                  ...prev, 
                  seed: parseInt(e.target.value) || 0 
                }))}
                className="flex-1"
              />
              <Button variant="outline" onClick={generateNewSeed}>
                Random
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Same seed = same arena layout and hazard patterns
            </p>
          </div>

          {/* Options */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="wrap"
                checked={options.wrap}
                onCheckedChange={(checked) => setOptions(prev => ({ ...prev, wrap: checked }))}
              />
              <Label htmlFor="wrap">Screen Wrap</Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch
                id="hazards"
                checked={options.hazards}
                onCheckedChange={(checked) => setOptions(prev => ({ ...prev, hazards: checked }))}
              />
              <Label htmlFor="hazards">Volcano Hazards</Label>
            </div>
          </div>

          {/* Controls Info */}
          <div className="text-xs text-muted-foreground space-y-1">
            <p><strong>Controls:</strong></p>
            <p>P1: Gamepad or Arrow Keys + Space (fire) + Shift (rotate boost)</p>
            <p>P2: Second Gamepad or WASD + F (fire) + Left Shift (rotate boost)</p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 justify-center">
            <Button
              ref={startBtnRef}
              variant="neon"
              size="lg"
              onClick={handleStartMatch}
              className="px-8"
            >
              Start Match
            </Button>
            
            <Button
              ref={backBtnRef}
              variant="outline" 
              size="lg"
              onClick={() => navigate("/")}
              className="px-8"
            >
              Back to Home
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}