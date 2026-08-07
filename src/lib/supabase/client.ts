import { createClient } from "@supabase/supabase-js"

import type { Database } from "./types"

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * True once real Supabase credentials are in `.env.local`. The app shell
 * (landing/join pages) still renders without them; anything that actually
 * calls Supabase (auth, class data) will surface a clear error instead of
 * failing silently -- see `useAuth`'s handling of failed calls.
 */
export const isSupabaseConfigured = Boolean(
  supabaseUrl && supabaseAnonKey && !supabaseUrl.includes("your-project-ref"),
)

if (!isSupabaseConfigured) {
  console.warn(
    "[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set (or still placeholders) " +
      "in .env.local. Auth and data calls will fail until a real Supabase project is configured.",
  )
}

/**
 * Single shared Supabase client, used by both the teacher app (/t/*, real
 * email/password sessions) and the student app (/s/*, Anonymous Auth
 * sessions) -- see docs/architecture.md for why one client/project serves
 * both roles.
 */
export const supabase = createClient<Database>(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-anon-key",
)
