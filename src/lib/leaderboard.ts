import { supabase } from "@/integrations/supabase/client";
import type { Difficulty, Mode } from "@/components/game/types";

export type ScoreRow = {
  id?: string;
  initials: string;
  score: number;
  difficulty: Difficulty;
  mode: Mode;
  created_at?: string;
};

/**
 * Submit a new high score to the leaderboard
 */
export async function submitScore(row: ScoreRow): Promise<{ ok: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('scores')
      .insert({
        initials: row.initials.toUpperCase().slice(0, 3),
        score: row.score,
        difficulty: row.difficulty,
        mode: row.mode,
      });

    if (error) {
      console.error('Error submitting score:', error);
      return { ok: false, error: error.message };
    }

    return { ok: true };
  } catch (e: any) {
    console.error('Error submitting score:', e);
    return { ok: false, error: e?.message || "Network error" };
  }
}

/**
 * Fetch top scores for a specific mode
 */
export async function fetchTop(
  mode: Mode,
  limit = 10
): Promise<{ rows: ScoreRow[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('scores')
      .select('id, initials, score, difficulty, mode, created_at')
      .eq('mode', mode)
      .order('score', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching scores:', error);
      return { rows: [], error: error.message };
    }

    return { rows: (data || []) as ScoreRow[] };
  } catch (e: any) {
    console.error('Error fetching scores:', e);
    return { rows: [], error: e?.message || "Network error" };
  }
}

/**
 * Fetch top scores for a specific mode AND difficulty
 */
export async function fetchTopByDifficulty(
  mode: Mode,
  difficulty: Difficulty,
  limit = 10
): Promise<{ rows: ScoreRow[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('scores')
      .select('id, initials, score, difficulty, mode, created_at')
      .eq('mode', mode)
      .eq('difficulty', difficulty)
      .order('score', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching scores:', error);
      return { rows: [], error: error.message };
    }

    return { rows: (data || []) as ScoreRow[] };
  } catch (e: any) {
    console.error('Error fetching scores:', e);
    return { rows: [], error: e?.message || "Network error" };
  }
}
