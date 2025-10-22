import { supabase } from "@/integrations/supabase/client";
import type { Difficulty, Mode } from "@/components/game/types";

// Diagnostic: Check if Supabase client is properly initialized
console.log('🔧 Leaderboard module loaded', {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL ? '✓' : '❌',
  supabaseKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ? '✓' : '❌',
  clientInitialized: !!supabase
});

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
    console.log('🔍 Checking global record...', { level, difficulty, completionTime });
    
    const { data, error } = await supabase
      .from('ghost_records')
      .select('*')
      .eq('level', level)
      .eq('difficulty', difficulty)
      .single();

    console.log('🔍 Supabase query result:', { data, error, errorCode: error?.code });

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
      console.error('❌ Database error in checkGlobalRecord:', error);
      return { isRecord: false, currentRecord: null, error: error.message };
    }

    // No existing record = new record!
    if (!data) {
      console.log('✨ No existing record found - this will be a new world record!');
      return { isRecord: true, currentRecord: null };
    }

    // Check if new time is faster
    const isRecord = completionTime < data.completion_time;
    console.log('📊 Existing record comparison:', {
      existingTime: data.completion_time,
      newTime: completionTime,
      isRecord,
      existingInitials: data.initials
    });
    
    return { isRecord, currentRecord: data as GlobalGhostRecord };
  } catch (e: any) {
    console.error('💥 Exception in checkGlobalRecord:', e);
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
  initials: string = ""
): Promise<{ ok: boolean; error?: string }> {
  try {
    console.log('📤 Submitting global ghost...', {
      level,
      difficulty,
      completionTime,
      initials: initials || "(none)",
      dataSize: JSON.stringify(ghostData).length
    });
    
    const { error } = await supabase
      .from('ghost_records')
      .upsert({
        level,
        difficulty,
        completion_time: completionTime,
        ghost_data: ghostData,
        initials: initials ? initials.toUpperCase().slice(0, 3) : null
      }, {
        onConflict: 'level,difficulty'
      });

    if (error) {
      console.error('❌ Database error in submitGlobalGhost:', error);
      console.error('❌ Error details:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
      return { ok: false, error: error.message };
    }

    console.log('✅ Global ghost submitted successfully!');
    return { ok: true };
  } catch (e: any) {
    console.error('💥 Exception in submitGlobalGhost:', e);
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
    console.log('📥 Fetching global ghost:', { level, difficulty });
    
    const { data, error } = await supabase
      .from('ghost_records')
      .select('*')
      .eq('level', level)
      .eq('difficulty', difficulty)
      .order('completion_time', { ascending: true })
      .limit(1)
      .maybeSingle();

    console.log('📦 Fetch result:', { hasData: !!data, error: error?.message });

    if (error) {
      console.error('Error fetching global ghost:', error);
      return { record: null, error: error.message };
    }

    return { record: data as GlobalGhostRecord | null };
  } catch (e: any) {
    console.error('Error fetching global ghost:', e);
    return { record: null, error: e?.message || "Network error" };
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
        completion_time: completionTime
      } as any);

    if (error) {
      console.error('Error submitting time trial score:', error);
      return { ok: false, error: error.message };
    }

    return { ok: true };
  } catch (e: any) {
    console.error('Error submitting time trial score:', e);
    return { ok: false, error: e?.message || "Network error" };
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
    const query: any = supabase
      .from('scores')
      .select('*');
    
    const { data, error } = await query
      .eq('mode', 'timetrial')
      .eq('level', level)
      .eq('difficulty', difficulty)
      .order('completion_time', { ascending: true })
      .limit(limit);

    if (error) {
      console.error('Error fetching time trial leaderboard:', error);
      return { rows: [], error: error.message };
    }

    return { rows: (data as ScoreRow[]) || [] };
  } catch (e: any) {
    console.error('Error fetching time trial leaderboard:', e);
    return { rows: [], error: e?.message || "Network error" };
  }
}
