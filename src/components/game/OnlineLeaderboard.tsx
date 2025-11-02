import React, { useEffect, useState } from "react";
import { Mode, Difficulty } from "@/components/game/types";
import { fetchTop, fetchTopByDifficulty } from "@/lib/leaderboard";
import { InitialsBadge } from "./InitialsBadge";

interface Props { 
  mode: Mode;
  difficulty?: Difficulty;
  highlightScore?: {
    score: number;
    initials: string;
    mode: Mode;
    difficulty: Difficulty;
    timestamp: number;
  } | null;
}

export const OnlineLeaderboard: React.FC<Props> = ({ mode, difficulty, highlightScore }) => {
  const [rows, setRows] = useState<{ initials: string; score: number; difficulty: string; created_at?: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    
    const fetchFn = difficulty 
      ? fetchTopByDifficulty(mode, difficulty, 10)
      : fetchTop(mode, 10);
    
    fetchFn.then((res) => {
      if (!mounted) return;
      if (res.error) setError(res.error);
      setRows(res.rows || []);
      setLoading(false);
    });
    
    return () => { mounted = false; };
  }, [mode, difficulty]);

  return (
    <div className="mt-6 text-left bg-card/50 border border-border/60 rounded-lg p-4 w-[min(90vw,720px)]">
      <div className="flex items-center justify-between">
        <div className="text-sm uppercase tracking-wider text-muted-foreground">
          Global Leaderboard · {mode.charAt(0).toUpperCase() + mode.slice(1)}
          {difficulty && ` · ${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}`}
        </div>
      </div>
      <div className="mt-2">
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : error ? (
          <div className="text-sm text-destructive">
            Online leaderboard unavailable: {error}
          </div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-muted-foreground">No scores yet. Be the first!</div>
        ) : (
          <ol className="space-y-2">
            {rows.map((r, i) => {
              // Check if this row matches the highlighted score
              const isHighlighted = highlightScore &&
                highlightScore.mode === mode &&
                highlightScore.score === r.score &&
                highlightScore.initials.toUpperCase() === r.initials.toUpperCase() &&
                (Date.now() - highlightScore.timestamp < 120000); // Within 2 minutes

              return (
                <li 
                  key={`${r.initials}-${i}`} 
                  className={`flex items-center justify-between text-sm ${
                    isHighlighted 
                      ? 'bg-accent/20 border-l-4 border-accent pl-2 -ml-2 rounded-r animate-pulse-subtle shadow-[0_0_20px_hsl(var(--accent)/0.3)]' 
                      : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-foreground/90 w-5 text-right">{i + 1}.</span>
                    <InitialsBadge initials={r.initials} />
                  </div>
                  <span className="text-accent font-semibold">{r.score.toLocaleString()}</span>
                  <span className="text-muted-foreground hidden sm:block">
                    {r.created_at ? new Date(r.created_at).toLocaleDateString() : ""}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
};
