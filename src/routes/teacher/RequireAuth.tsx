import { Navigate, Outlet } from "react-router-dom"

import { useAuth } from "@/features/auth/useAuth"
import { RouteLoading } from "@/components/route-loading"

/**
 * Guards all /t/* routes behind a teacher's Supabase Auth session.
 * Redirects to /t/login when unauthenticated; renders nothing (past the
 * loading spinner) until the initial session check resolves, so a
 * logged-out teacher never sees a flash of protected content.
 */
export function RequireAuth() {
  const { status } = useAuth()

  if (status === "loading") {
    return <RouteLoading />
  }

  if (status === "unauthenticated") {
    return <Navigate to="/t/login" replace />
  }

  return <Outlet />
}
