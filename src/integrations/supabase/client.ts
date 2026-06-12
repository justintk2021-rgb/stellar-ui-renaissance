import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/** False when Vite env is missing (avoids a blank screen from a thrown import). */
export const isSupabaseConfigured = Boolean(
  SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY,
);

if (!isSupabaseConfigured) {
  console.error(
    "Missing Supabase env vars. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to .env or Vercel project settings.",
  );
}

// Vite SPA client — session refresh is handled client-side via autoRefreshToken.
export const supabase = createClient<Database>(
  SUPABASE_URL || "https://invalid.local",
  SUPABASE_PUBLISHABLE_KEY || "invalid",
  {
    auth: {
      storage: localStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);