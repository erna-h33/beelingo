import { Outlet } from "react-router-dom"

/**
 * Guards all /t/* routes behind a teacher's Supabase Auth session.
 *
 * Stubbed as a pass-through for M1 (no Supabase project wired up yet).
 * M2 replaces this with a real session check (redirect to /t/login when
 * unauthenticated) once teacher auth is implemented.
 */
export function RequireAuth() {
  return <Outlet />
}
