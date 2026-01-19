import React, { useEffect, useState } from "react";
import { fetchTop, type ScoreRow } from "@/lib/leaderboard";
import type { Mode } from "./types";

interface PlayerMenuLeaderboardProps {
  mode: Mode;
  label: string;
}

/** Leaderboard display styled to match Player Menu aesthetics */
export const PlayerMenuLeaderboard: React.FC<PlayerMenuLeaderboardProps> = ({ mode, label }) => {
  const [rows, setRows] = useState<ScoreRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    
    fetchTop(mode, 5).then(res => {
      if (mounted) {
        setRows(res.rows || []);
        setLoading(false);
      }
    });
    
    return () => { mounted = false; };
  }, [mode]);

  // Always render 5 rows for consistent height (real or placeholder)
  const displayRows = [...rows];
  while (displayRows.length < 5) {
    displayRows.push({ initials: "---", score: 0, difficulty: "easy", mode } as ScoreRow);
  }

  return (
    <div 
      className="w-full max-w-xs p-5 border-2 rounded-lg bg-background/70 backdrop-blur-sm h-[280px] flex flex-col overflow-hidden"
      style={{ borderColor: "hsl(var(--neon) / 0.4)" }}
    >
      <h2 
        className="text-center text-base font-display tracking-wider mb-4 uppercase"
        style={{ color: "hsl(var(--neon))" }}
      >
        HIGH SCORES · {label}
      </h2>
      
      {loading ? (
        <div 
          className="flex-1 flex items-center justify-center text-sm opacity-50"
          style={{ color: "hsl(var(--neon))" }}
        >
          Loading...
        </div>
      ) : (
        <ol className="space-y-3 flex-1">
          {displayRows.map((r, i) => {
            const isEmpty = r.initials === "---" || !r.score;
            return (
              <li 
                key={`${r.id || 'empty'}-${i}`}
                className={`flex items-center justify-between text-sm h-8 ${isEmpty ? 'opacity-30' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <span 
                    className="w-5 text-right font-mono opacity-60"
                    style={{ color: "hsl(var(--foreground))" }}
                  >
                    {i + 1}.
                  </span>
                  <span 
                    className="font-display tracking-wider uppercase"
                    style={{ 
                      color: "hsl(var(--neon))",
                      textShadow: isEmpty ? "none" : "0 0 8px hsl(var(--neon) / 0.5)"
                    }}
                  >
                    {r.initials || "---"}
                  </span>
                </div>
                <span 
                  className="font-display tracking-wider"
                  style={{ 
                    color: "hsl(var(--neon))",
                    textShadow: isEmpty ? "none" : "0 0 8px hsl(var(--neon) / 0.5)"
                  }}
                >
                  {isEmpty ? "---" : r.score.toLocaleString()}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
};

export default PlayerMenuLeaderboard;
