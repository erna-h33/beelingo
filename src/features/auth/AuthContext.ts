import { createContext } from "react"
import type { Session } from "@supabase/supabase-js"

export interface AuthState {
  /** `"loading"` while the initial session check is still in flight. */
  status: "loading" | "authenticated" | "unauthenticated"
  session: Session | null
}

export const AuthContext = createContext<AuthState | undefined>(undefined)
