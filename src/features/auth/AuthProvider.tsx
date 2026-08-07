import { useEffect, useState, type ReactNode } from "react"
import type { Session } from "@supabase/supabase-js"

import { supabase } from "@/lib/supabase/client"
import { AuthContext, type AuthState } from "./AuthContext"

/**
 * Tracks the teacher's Supabase Auth session for the whole app. Mounted
 * once in `App.tsx`, above the router, so both `RequireAuth` and any
 * teacher-side UI (e.g. the account menu) can read it via `useAuth()`.
 *
 * Deliberately ignores anonymous sessions (students, arriving in M4) --
 * `RequireDevice` will get its own equivalent provider then, scoped
 * separately, so the two identities never get tangled together in one
 * context.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    status: "loading",
    session: null,
  })

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setState(toAuthState(data.session))
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setState(toAuthState(session))
    })

    return () => subscription.subscription.unsubscribe()
  }, [])

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}

function toAuthState(session: Session | null): AuthState {
  // A real teacher session is a non-anonymous one; an anonymous (student)
  // session should never register as "logged in" here.
  const isTeacherSession = Boolean(session) && session?.user.is_anonymous !== true
  return {
    status: isTeacherSession ? "authenticated" : "unauthenticated",
    session: isTeacherSession ? session : null,
  }
}
