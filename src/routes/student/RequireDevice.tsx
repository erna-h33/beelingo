import { Outlet } from "react-router-dom"

/**
 * Guards all /s/* routes (except /join) behind a recognized device
 * (a persisted Supabase anonymous session linked to a class_students row).
 *
 * Stubbed as a pass-through for M1 (no Supabase project wired up yet).
 * M4 replaces this with a real check (redirect to /join when no valid
 * device session exists) once the student join flow is implemented.
 */
export function RequireDevice() {
  return <Outlet />
}
