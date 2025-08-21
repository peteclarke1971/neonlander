import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Lovable Supabase native integration: URL and anon key are injected at runtime.
// We avoid env vars per project constraints.
const url = (globalThis as any).__SUPABASE_URL__ || (globalThis as any).SUPABASE_URL || (globalThis as any).VITE_SUPABASE_URL;
const anon = (globalThis as any).__SUPABASE_ANON_KEY__ || (globalThis as any).SUPABASE_ANON_KEY || (globalThis as any).VITE_SUPABASE_ANON_KEY;

export const supabase: SupabaseClient | null = url && anon ? createClient(url, anon) : null;

export const isSupabaseConfigured = !!supabase;
