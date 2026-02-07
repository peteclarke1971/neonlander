import React, { useEffect, useState } from "react";
import { fetchTop, type ScoreRow } from "@/lib/leaderboard";
import { getMedleyHighScores } from "@/lib/medleyLeaderboard";
import type { Mode } from "./types";

/** localStorage key mapping for local leaderboard reading */
const LOCAL_STORAGE_KEYS: Record<string, string> = {
  fixed: "ll-highscores-fixed",
  classic: "ll-highscores-classic",
  survival: "survival-mode-high-scores",
  medley: "medleyHighScores_easy",
};

interface LocalScore {
  initials: string;
  score: number;
}

/** Standard seed scores for any mode on first launch */
function getDefaultLocalScores(): LocalScore[] {
  return [
    { initials: "IH",  score: 50000 },
    { initials: "SDP", score: 30000 },
    { initials: "PC",  score: 15000 },
    { initials: "ASH", score: 10000 },
    { initials: "IAN", score: 5000 },
  ];
}

/** Read local high scores from localStorage for a given mode */
function readLocalScores(mode: Mode): LocalScore[] {
  try {
    if (mode === "medley") {
      // Medley uses its own module which handles seeding
      const scores = getMedleyHighScores("easy");
      return scores.map(s => ({ initials: s.initials, score: s.score }));
    }
    
    const key = LOCAL_STORAGE_KEYS[mode];
    if (!key) return [];
    
    const raw = localStorage.getItem(key);
    if (!raw) {
      // Auto-seed on first access so the leaderboard is never empty
      const defaults = getDefaultLocalScores();
      localStorage.setItem(key, JSON.stringify(defaults));
      return defaults;
    }
    
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      const defaults = getDefaultLocalScores();
      localStorage.setItem(key, JSON.stringify(defaults));
      return defaults;
    }
    
    return parsed
      .slice(0, 5)
      .map((entry: any) => ({
        initials: entry.initials || "---",
        score: entry.score || 0,
      }));
  } catch {
    return [];
  }
}

interface PlayerMenuLeaderboardProps {
  mode: Mode;
  label: string;
  source?: "local" | "global";
}

/** Leaderboard display styled to match Player Menu aesthetics */
export const PlayerMenuLeaderboard: React.FC<PlayerMenuLeaderboardProps> = ({ mode, label, source = "global" }) => {
  const [rows, setRows] = useState<LocalScore[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    
    if (source === "local") {
      // Read from localStorage synchronously
      const localRows = readLocalScores(mode);
      if (mounted) {
        setRows(localRows);
        setLoading(false);
      }
    } else {
      // Fetch from online database
      fetchTop(mode, 5).then(res => {
        if (mounted) {
          setRows((res.rows || []).map(r => ({ initials: r.initials, score: r.score })));
          setLoading(false);
        }
      });
    }
    
    return () => { mounted = false; };
  }, [mode, source]);

  // Always render 5 rows for consistent height (real or placeholder)
  const displayRows = [...rows];
  while (displayRows.length < 5) {
    displayRows.push({ initials: "---", score: 0 });
  }

  const heading = source === "global" 
    ? `GLOBAL HIGH SCORES · ${label}`
    : `HIGH SCORES · ${label}`;

  return (
    <div 
      className="w-full max-w-xs p-5 border-2 rounded-lg bg-background/70 backdrop-blur-sm h-[280px] flex flex-col overflow-hidden"
      style={{ borderColor: "hsl(var(--neon) / 0.4)" }}
    >
      <h2 
        className="text-center text-base font-display tracking-wider mb-4 uppercase"
        style={{ color: "hsl(var(--neon))" }}
      >
        {heading}
      </h2>
      
      {loading ? (
        <div 
          className="flex-1 flex items-center justify-center text-sm opacity-50"
          style={{ color: "hsl(var(--neon))" }}
        >
          Loading...
        </div>
      ) : (
        <ol className="space-y-2 flex-1">
          {displayRows.map((r, i) => {
            const isEmpty = r.initials === "---" || !r.score;
            return (
              <li 
                key={`${r.initials}-${i}`}
                className={`flex items-center justify-between text-sm h-8 ${isEmpty ? 'opacity-30' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <span 
                    className="w-5 text-right font-mono opacity-60"
                    style={{ 
                      color: "hsl(var(--neon))",
                      textShadow: isEmpty ? "none" : "0 0 8px hsl(var(--neon) / 0.5)"
                    }}
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
