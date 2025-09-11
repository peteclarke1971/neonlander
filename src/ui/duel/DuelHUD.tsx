import React from "react";
import { DuelGameState } from "@/engine/duel/types";

interface DuelHUDProps {
  gameState: DuelGameState;
}

export const DuelHUD: React.FC<DuelHUDProps> = ({ gameState }) => {
  const { players, phase, currentRound, roundTimer, suddenDeath } = gameState;
  const [p1, p2] = players;

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const renderArmorPips = (armor: number, maxArmor: number = 4) => {
    const pips = [];
    for (let i = 0; i < maxArmor; i++) {
      pips.push(
        <div
          key={i}
          className={`w-3 h-3 border border-primary ${
            i < armor ? "bg-primary shadow-neon" : "bg-transparent"
          }`}
        />
      );
    }
    return <div className="flex gap-1">{pips}</div>;
  };

  const renderFuelBar = (fuel: number, maxFuel: number) => {
    const percentage = (fuel / maxFuel) * 100;
    return (
      <div className="w-24 h-2 border border-primary bg-background">
        <div
          className="h-full bg-primary transition-all duration-200"
          style={{ width: `${Math.max(0, percentage)}%` }}
        />
      </div>
    );
  };

  const renderPowerupIcon = (
    powerupType: string | null,
    timeLeft: number,
    shieldHits: number
  ) => {
    if (!powerupType) return null;

    const radius = 20;
    const circumference = 2 * Math.PI * radius;
    const progress = timeLeft / 8; // 8 second duration
    const strokeDasharray = circumference;
    const strokeDashoffset = circumference * (1 - progress);

    return (
      <div className="relative w-12 h-12 flex items-center justify-center">
        {/* Decay ring */}
        <svg className="absolute inset-0 w-12 h-12 -rotate-90">
          <circle
            cx="24"
            cy="24"
            r={radius}
            stroke="hsl(var(--primary))"
            strokeWidth="2"
            fill="none"
            strokeDasharray={strokeDasharray}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-200"
          />
        </svg>

        {/* Icon */}
        <div className="text-primary text-lg font-bold">
          {powerupType === "twin" && "⫸"}
          {powerupType === "tri" && "⫿"}
          {powerupType === "shield" && `🛡${shieldHits}`}
        </div>
      </div>
    );
  };

  const renderRoundScore = () => {
    const maxRounds = 3;
    const p1Wins = p1.roundsWon;
    const p2Wins = p2.roundsWon;

    const renderWinIndicators = (wins: number) => {
      const indicators = [];
      for (let i = 0; i < 2; i++) {
        // First to 2 wins
        indicators.push(
          <div
            key={i}
            className={`w-4 h-4 border border-primary ${
              i < wins ? "bg-primary shadow-neon" : "bg-transparent"
            }`}
          />
        );
      }
      return <div className="flex gap-1">{indicators}</div>;
    };

    return (
      <div className="flex items-center gap-4 text-foreground">
        <div className="text-right">
          <div className="text-sm text-muted-foreground">P1</div>
          {renderWinIndicators(p1Wins)}
        </div>
        
        <div className="text-center">
          <div className="text-xl font-bold">
            Round {currentRound}
            {suddenDeath && <span className="text-destructive ml-2">SUDDEN DEATH</span>}
          </div>
          {phase === "active" && (
            <div className="text-sm text-muted-foreground">
              {formatTime(roundTimer)}
            </div>
          )}
        </div>
        
        <div className="text-left">
          <div className="text-sm text-muted-foreground">P2</div>
          {renderWinIndicators(p2Wins)}
        </div>
      </div>
    );
  };

  return (
    <div className="absolute inset-0 pointer-events-none text-foreground">
      {/* Top Center - Round Score */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2">
        {renderRoundScore()}
      </div>

      {/* Top Left - P1 Stats */}
      <div className="absolute top-4 left-4 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">P1</span>
          {renderArmorPips(p1.armor)}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">FUEL</span>
          {renderFuelBar(p1.fuel, p1.maxFuel)}
        </div>
      </div>

      {/* Top Right - P2 Stats */}
      <div className="absolute top-4 right-4 space-y-2">
        <div className="flex items-center gap-2 justify-end">
          {renderArmorPips(p2.armor)}
          <span className="text-sm text-muted-foreground">P2</span>
        </div>
        <div className="flex items-center gap-2 justify-end">
          {renderFuelBar(p2.fuel, p2.maxFuel)}
          <span className="text-xs text-muted-foreground">FUEL</span>
        </div>
      </div>

      {/* Bottom Left - P1 Powerup */}
      <div className="absolute bottom-4 left-4">
        {renderPowerupIcon(p1.activePowerup, p1.powerupTimeLeft, p1.shieldHitsLeft)}
      </div>

      {/* Bottom Right - P2 Powerup */}
      <div className="absolute bottom-4 right-4">
        {renderPowerupIcon(p2.activePowerup, p2.powerupTimeLeft, p2.shieldHitsLeft)}
      </div>

      {/* Phase Overlays */}
      {phase === "round-end" && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="text-center">
            <div className="text-4xl font-bold mb-4">
              {gameState.players.find(p => p.armor > 0) ? `Player ${gameState.players.find(p => p.armor > 0)?.id} Wins!` : "Round Over"}
            </div>
            <div className="text-muted-foreground">Next round starting...</div>
          </div>
        </div>
      )}

      {phase === "match-end" && gameState.matchWinner && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/90 backdrop-blur-sm">
          <div className="text-center space-y-4">
            <div className="text-6xl font-bold text-primary">
              Player {gameState.matchWinner} Wins!
            </div>
            <div className="text-xl text-muted-foreground">
              Best of 3 - Match Complete
            </div>
          </div>
        </div>
      )}
    </div>
  );
};