import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { getTimeTrialDescription } from "./systems/timeTrialLevels";

type Difficulty = "easy" | "hard";

interface TimeTrialHomeProps {
  onStart: (level: number, difficulty: Difficulty) => void;
  onBack: () => void;
}

export const TimeTrialHome: React.FC<TimeTrialHomeProps> = ({ onStart, onBack }) => {
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [bestTimes, setBestTimes] = useState<Map<number, number>>(new Map());

  useEffect(() => {
    // Load best times from localStorage
    const saved = localStorage.getItem(`timetrial-best-times-${difficulty}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setBestTimes(new Map(Object.entries(parsed).map(([k, v]) => [parseInt(k), v as number])));
      } catch (e) {
        console.error('Failed to load best times:', e);
      }
    }
  }, [difficulty]);

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const milliseconds = Math.floor((ms % 1000) / 10);
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
  };

  const levelButtons = [1, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/10">
      <div className="max-w-4xl w-full p-8 space-y-8">
        {/* Title */}
        <div className="text-center space-y-2">
          <h1 className="text-6xl font-bold text-primary tracking-wider neon-glow">
            TIME TRIAL
          </h1>
          <p className="text-muted-foreground text-lg">
            Race through sequential pads as fast as possible
          </p>
        </div>

        {/* Difficulty Selector */}
        <div className="flex justify-center gap-4">
          <Button
            size="lg"
            variant={difficulty === "easy" ? "default" : "outline"}
            onClick={() => setDifficulty("easy")}
            className="w-32"
          >
            EASY
          </Button>
          <Button
            size="lg"
            variant={difficulty === "hard" ? "default" : "outline"}
            onClick={() => setDifficulty("hard")}
            className="w-32"
          >
            HARD
          </Button>
        </div>

        {/* Level Select Grid */}
        <div className="bg-card/50 border border-border/60 rounded-lg p-6 space-y-4">
          <h2 className="text-2xl font-bold text-center text-accent">SELECT LEVEL</h2>
          
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
            {levelButtons.map(level => {
              const bestTime = bestTimes.get(level);
              return (
                <div key={level} className="space-y-1">
                  <Button
                    onClick={() => onStart(level, difficulty)}
                    className="w-full"
                    variant="outline"
                  >
                    {level}
                  </Button>
                  {bestTime && (
                    <div className="text-xs text-center text-accent font-mono">
                      {formatTime(bestTime)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Best Times Table */}
        {bestTimes.size > 0 && (
          <div className="bg-card/50 border border-border/60 rounded-lg p-6 space-y-4">
            <h2 className="text-xl font-bold text-accent">YOUR BEST TIMES</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {Array.from(bestTimes.entries())
                .sort((a, b) => a[0] - b[0])
                .slice(0, 10)
                .map(([level, time]) => (
                  <div key={level} className="flex justify-between items-center text-sm border-b border-border/30 pb-2">
                    <span className="text-muted-foreground">
                      Level {level}: {getTimeTrialDescription(level)}
                    </span>
                    <span className="text-accent font-mono font-bold">{formatTime(time)}</span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Back Button */}
        <div className="flex justify-center">
          <Button onClick={onBack} variant="outline" size="lg">
            BACK TO MAIN MENU
          </Button>
        </div>
      </div>
    </div>
  );
};
