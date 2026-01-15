import { supabase } from "@/integrations/supabase/client";
import type { Difficulty, Mode } from "@/components/game/types";
import { logger } from "./logger";

export type ScoreRow = {
  id?: string;
  initials: string;
  score: number;
  difficulty: Difficulty;
  mode: Mode;
  created_at?: string;
  level?: number;
  completion_time?: number;
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
        level: row.level,
        completion_time: row.completion_time,
      });

    if (error) {
      logger.error('Error submitting score:', error);
      return { ok: false, error: error.message };
    }

    return { ok: true };
  } catch (e: unknown) {
    const err = e as Error;
    logger.error('Error submitting score:', err);
    return { ok: false, error: err?.message || "Network error" };
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
      logger.error('Error fetching scores:', error);
      return { rows: [], error: error.message };
    }

    return { rows: (data || []) as ScoreRow[] };
  } catch (e: unknown) {
    const err = e as Error;
    logger.error('Error fetching scores:', err);
    return { rows: [], error: err?.message || "Network error" };
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
      logger.error('Error fetching scores:', error);
      return { rows: [], error: error.message };
    }

    return { rows: (data || []) as ScoreRow[] };
  } catch (e: unknown) {
    const err = e as Error;
    logger.error('Error fetching scores:', err);
    return { rows: [], error: err?.message || "Network error" };
  }
}

// ============= Global Ghost System =============

// Use a flexible type for ghost data to accommodate various recording formats
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type GhostData = any;

export interface GlobalGhostRecord {
  id?: string;
  level: number;
  difficulty: Difficulty;
  mode: Mode;
  completion_time: number;
  ghost_data: GhostData; // eslint-disable-line @typescript-eslint/no-explicit-any
  initials: string;
  created_at?: string;
}

/**
 * Check if a time beats the current global record for a level
 */
export async function checkGlobalRecord(
  level: number,
  difficulty: Difficulty,
  mode: Mode,
  completionTime: number
): Promise<{ isRecord: boolean; currentRecord: GlobalGhostRecord | null; error?: string }> {
  try {
    logger.debug('Checking global record...', { level, difficulty, mode, completionTime });
    
    const { data, error } = await supabase
      .from('ghost_records')
      .select('*')
      .eq('level', level)
      .eq('difficulty', difficulty)
      .eq('mode', mode)
      .single();

    logger.debug('Query result:', { hasData: !!data, errorCode: error?.code });

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
      logger.error('Database error in checkGlobalRecord:', error);
      return { isRecord: false, currentRecord: null, error: error.message };
    }

    // No existing record = new record!
    if (!data) {
      logger.debug('No existing record found - new world record');
      return { isRecord: true, currentRecord: null };
    }

    // Check if new time is faster
    const isRecord = completionTime < data.completion_time;
    logger.debug('Record comparison:', { existingTime: data.completion_time, newTime: completionTime, isRecord });
    
    return { isRecord, currentRecord: data as GlobalGhostRecord };
  } catch (e: unknown) {
    const err = e as Error;
    logger.error('Exception in checkGlobalRecord:', err);
    return { isRecord: false, currentRecord: null, error: err?.message || "Network error" };
  }
}

/**
 * Submit a new global ghost record (upsert)
 */
export async function submitGlobalGhost(
  level: number,
  difficulty: Difficulty | string,
  mode: Mode | string,
  completionTime: number,
  ghostData: GhostData,
  initials: string = ""
): Promise<{ ok: boolean; error?: string }> {
  try {
    logger.debug('Submitting global ghost...', { level, difficulty, mode, completionTime });
    
    const { error } = await supabase
      .from('ghost_records')
      .upsert({
        level,
        difficulty: difficulty as string,
        mode: mode as string,
        completion_time: completionTime,
        ghost_data: ghostData as GhostData,
        initials: initials ? initials.toUpperCase().slice(0, 3) : null
      }, {
        onConflict: 'level,difficulty,mode'
      });

    if (error) {
      logger.error('Database error in submitGlobalGhost:', error);
      return { ok: false, error: error.message };
    }

    logger.debug('Global ghost submitted successfully');
    return { ok: true };
  } catch (e: unknown) {
    const err = e as Error;
    logger.error('Exception in submitGlobalGhost:', err);
    return { ok: false, error: err?.message || "Network error" };
  }
}

/**
 * Fetch the global ghost record for a specific level
 */
export async function fetchGlobalGhost(
  level: number,
  difficulty: Difficulty,
  mode: Mode
): Promise<{ record: GlobalGhostRecord | null; error?: string }> {
  try {
    logger.debug('Fetching global ghost:', { level, difficulty, mode });
    
    const { data, error } = await supabase
      .from('ghost_records')
      .select('*')
      .eq('level', level)
      .eq('difficulty', difficulty)
      .eq('mode', mode)
      .order('completion_time', { ascending: true })
      .limit(1)
      .maybeSingle();

    logger.debug('Fetch result:', { hasData: !!data, hasGhostData: !!data?.ghost_data });

    if (error) {
      logger.error('Error fetching global ghost:', error);
      return { record: null, error: error.message };
    }

    return { record: data as GlobalGhostRecord | null };
  } catch (e: unknown) {
    const err = e as Error;
    logger.error('Error fetching global ghost:', err);
    return { record: null, error: err?.message || "Network error" };
  }
}

/**
 * Submit a Time Trial completion time to the leaderboard
 */
export async function submitTimeTrialScore(
  level: number,
  difficulty: Difficulty,
  completionTime: number,
  initials: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('scores')
      .insert({
        initials: initials.toUpperCase().slice(0, 3),
        score: 0,
        difficulty,
        mode: 'timetrial' as Mode,
        level,
        completion_time: Math.round(completionTime)
      });

    if (error) {
      logger.error('Error submitting time trial score:', error);
      return { ok: false, error: error.message };
    }

    return { ok: true };
  } catch (e: unknown) {
    const err = e as Error;
    logger.error('Error submitting time trial score:', err);
    return { ok: false, error: err?.message || "Network error" };
  }
}

/**
 * Fetch Time Trial leaderboard for a specific level and difficulty
 */
export async function fetchTimeTrialLeaderboard(
  level: number,
  difficulty: Difficulty,
  limit = 10
): Promise<{ rows: ScoreRow[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('scores')
      .select('*')
      .eq('mode', 'timetrial')
      .eq('level', level)
      .eq('difficulty', difficulty)
      .order('completion_time', { ascending: true })
      .limit(limit);

    if (error) {
      logger.error('Error fetching time trial leaderboard:', error);
      return { rows: [], error: error.message };
    }

    return { rows: (data as ScoreRow[]) || [] };
  } catch (e: unknown) {
    const err = e as Error;
    logger.error('Error fetching time trial leaderboard:', err);
    return { rows: [], error: err?.message || "Network error" };
  }
}
