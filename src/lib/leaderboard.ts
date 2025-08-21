import type { Difficulty, Mode } from "@/components/game/types";

export type ScoreRow = {
  id?: number;
  initials: string;
  score: number;
  difficulty: Difficulty;
  mode: Mode;
  created_at?: string;
};

// Temporary Google Sheets Web App endpoint (replace when switching to Supabase)
const GOOGLE_SHEETS_WEBAPP_URL =
  "https://script.google.com/macros/s/AKfycbya7Kpc_Ku4W47AsbNGw6BdP-pKfKWzQVVKTzHpQUff6UGUMwgY1ehsknFh2wozW7QX/exec";

export async function submitScore(row: ScoreRow): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(GOOGLE_SHEETS_WEBAPP_URL, {
      method: "POST",
      // Use text/plain to avoid CORS preflight while still sending JSON the script can parse
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      body: JSON.stringify({
        initials: row.initials,
        score: row.score,
        difficulty: row.difficulty,
        mode: row.mode,
      }),
    });

    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}` };
    }

    try {
      const data = await res.json();
      if (data?.ok === false && data?.error) return { ok: false, error: data.error };
    } catch {
      // Non-JSON response from Apps Script is fine
    }

    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Network error" };
  }
}

export async function fetchTop(
  mode: Mode,
  limit = 10
): Promise<{ rows: ScoreRow[]; error?: string }> {
  try {
    const url = new URL(GOOGLE_SHEETS_WEBAPP_URL);
    url.searchParams.set("mode", mode);
    url.searchParams.set("limit", String(limit));

    const res = await fetch(url.toString(), { method: "GET" });
    if (!res.ok) return { rows: [], error: `HTTP ${res.status}` };

    const data = await res.json();
    const rows = Array.isArray(data?.rows) ? data.rows : data;
    return { rows: (rows || []) as ScoreRow[] };
  } catch (e: any) {
    return { rows: [], error: e?.message || "Network error" };
  }
}
