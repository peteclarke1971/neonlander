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

// ============= Global Ghost System =============

export interface GlobalGhostRecord {
  id?: string;
  level: number;
  difficulty: Difficulty;
  completion_time: number;
  ghost_data: any; // GhostRecording
  initials: string;
  created_at?: string;
}

/**
 * Check if a time beats the current global record for a level
 */
export async function checkGlobalRecord(
  level: number,
  difficulty: Difficulty,
  completionTime: number
): Promise<{ isRecord: boolean; currentRecord: GlobalGhostRecord | null; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('ghost_records')
      .select('*')
      .eq('level', level)
      .eq('difficulty', difficulty)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
      console.error('Error checking global record:', error);
      return { isRecord: false, currentRecord: null, error: error.message };
    }

    // No existing record = new record!
    if (!data) {
      return { isRecord: true, currentRecord: null };
    }

    // Check if new time is faster
    const isRecord = completionTime < data.completion_time;
    return { isRecord, currentRecord: data as GlobalGhostRecord };
  } catch (e: any) {
    console.error('Error checking global record:', e);
    return { isRecord: false, currentRecord: null, error: e?.message || "Network error" };
  }
}

/**
 * Submit a new global ghost record (upsert)
 */
export async function submitGlobalGhost(
  level: number,
  difficulty: Difficulty,
  completionTime: number,
  ghostData: any,
  initials: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('ghost_records')
      .upsert({
        level,
        difficulty,
        completion_time: completionTime,
        ghost_data: ghostData,
        initials: initials.toUpperCase().slice(0, 3)
      }, {
        onConflict: 'level,difficulty'
      });

    if (error) {
      console.error('Error submitting global ghost:', error);
      return { ok: false, error: error.message };
    }

    return { ok: true };
  } catch (e: any) {
    console.error('Error submitting global ghost:', e);
    return { ok: false, error: e?.message || "Network error" };
  }
}

/**
 * Fetch the global ghost record for a specific level
 */
export async function fetchGlobalGhost(
  level: number,
  difficulty: Difficulty
): Promise<{ record: GlobalGhostRecord | null; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('ghost_records')
      .select('*')
      .eq('level', level)
      .eq('difficulty', difficulty)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching global ghost:', error);
      return { record: null, error: error.message };
    }

    return { record: data as GlobalGhostRecord | null };
  } catch (e: any) {
    console.error('Error fetching global ghost:', e);
    return { record: null, error: e?.message || "Network error" };
  }
}
