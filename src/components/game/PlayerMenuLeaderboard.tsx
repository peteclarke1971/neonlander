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

  return (
    <div 
      className="w-full max-w-xs p-5 border-2 rounded-lg bg-background/70 backdrop-blur-sm"
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
          className="text-center text-sm opacity-50 py-8"
          style={{ color: "hsl(var(--neon))" }}
        >
          Loading...
        </div>
      ) : rows.length === 0 ? (
        <div 
          className="text-center text-sm opacity-50 py-8"
          style={{ color: "hsl(var(--neon))" }}
        >
          No scores yet
        </div>
      ) : (
        <ol className="space-y-3">
          {rows.map((r, i) => (
            <li 
              key={`${r.id}-${i}`}
              className="flex items-center justify-between text-sm"
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
                    textShadow: "0 0 8px hsl(var(--neon) / 0.5)"
                  }}
                >
                  {r.initials || "???"}
                </span>
              </div>
              <span 
                className="font-semibold font-mono"
                style={{ color: "hsl(var(--foreground))" }}
              >
                {r.score.toLocaleString()}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
};

export default PlayerMenuLeaderboard;
