// Medley Mode Local Leaderboard System
// Tracks both score and furthest stage reached

import { Difficulty } from "@/components/game/types";

export interface MedleyScore {
  initials: string;
  score: number;
  furthestStage: number;
  difficulty: Difficulty;
  date: number; // epoch ms
}

const STORAGE_KEY_PREFIX = "medleyHighScores";

/**
 * Get the storage key for a specific difficulty
 */
function getStorageKey(difficulty: Difficulty): string {
  return `${STORAGE_KEY_PREFIX}_${difficulty}`;
}

/**
 * Get high scores for a specific difficulty
 */
export function getMedleyHighScores(difficulty: Difficulty): MedleyScore[] {
  try {
    const key = getStorageKey(difficulty);
    const stored = localStorage.getItem(key);
    if (!stored) return [];
    
    const scores = JSON.parse(stored) as MedleyScore[];
    return scores.sort((a, b) => {
      // Primary sort by score (descending)
      if (b.score !== a.score) return b.score - a.score;
      // Secondary sort by furthest stage (descending)
      if (b.furthestStage !== a.furthestStage) return b.furthestStage - a.furthestStage;
      // Tertiary sort by date (most recent first)
      return b.date - a.date;
    });
  } catch (err) {
    console.error("Failed to load medley high scores:", err);
    return [];
  }
}

/**
 * Save a new medley score
 * Maintains top 10 scores per difficulty
 */
export function saveMedleyScore(score: MedleyScore): void {
  try {
    const key = getStorageKey(score.difficulty);
    const existing = getMedleyHighScores(score.difficulty);
    
    // Add new score
    existing.push(score);
    
    // Sort and keep top 10
    existing.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.furthestStage !== a.furthestStage) return b.furthestStage - a.furthestStage;
      return b.date - a.date;
    });
    
    const top10 = existing.slice(0, 10);
    localStorage.setItem(key, JSON.stringify(top10));
    
    console.log("💾 Saved medley score:", score);
  } catch (err) {
    console.error("Failed to save medley score:", err);
  }
}

/**
 * Check if a score/stage qualifies as a high score
 */
export function isMedleyHighScore(
  score: number,
  furthestStage: number,
  difficulty: Difficulty
): boolean {
  const existing = getMedleyHighScores(difficulty);
  
  // Always qualifies if less than 10 scores
  if (existing.length < 10) return true;
  
  // Check if better than the worst high score
  const worstScore = existing[existing.length - 1];
  
  // Better score OR (same score but further stage)
  return score > worstScore.score || 
         (score === worstScore.score && furthestStage > worstScore.furthestStage);
}

/**
 * Get the rank of a score (1-indexed, 0 if not in top 10)
 */
export function getMedleyScoreRank(
  score: number,
  furthestStage: number,
  difficulty: Difficulty
): number {
  const existing = getMedleyHighScores(difficulty);
  
  for (let i = 0; i < existing.length; i++) {
    const entry = existing[i];
    if (score > entry.score || 
        (score === entry.score && furthestStage > entry.furthestStage)) {
      return i + 1;
    }
  }
  
  // If not better than any existing score, check if it would make top 10
  if (existing.length < 10) {
    return existing.length + 1;
  }
  
  return 0; // Not in top 10
}

/**
 * Clear all medley high scores (for debugging)
 */
export function clearMedleyHighScores(): void {
  try {
    localStorage.removeItem(getStorageKey("easy"));
    localStorage.removeItem(getStorageKey("hard"));
    console.log("🗑️ Cleared all medley high scores");
  } catch (err) {
    console.error("Failed to clear medley high scores:", err);
  }
}
