import { Navigate, Outlet } from "react-router-dom"

import { useStudentSessionQuery } from "@/features/studentSession/useStudentSession"
import { RouteLoading } from "@/components/route-loading"

/**
 * Guards all /s/* routes behind a recognized device (a persisted Supabase
 * anonymous session linked to a class_students row via student_devices).
 * Redirects to /join when no valid device session exists -- whether
 * because this device has never joined, or because its roster entry was
 * deactivated/the class archived since (get_my_student_session excludes
 * those, so it resolves to "unrecognized" the same as never having joined).
 */
export function RequireDevice() {
  const { data: session, isLoading } = useStudentSessionQuery()

  if (isLoading) {
    return <RouteLoading />
  }

  if (!session) {
    return <Navigate to="/join" replace />
  }

  return <Outlet />
}
