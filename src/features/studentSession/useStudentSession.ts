import { useQuery, useQueryClient } from "@tanstack/react-query"

import { supabase } from "@/lib/supabase/client"

export const STUDENT_SESSION_QUERY_KEY = ["studentSession"]

/**
 * Resolves "who is this device" -- powers RequireDevice, JoinPage's
 * auto-recognition-on-repeat-visit check, and StudentShell's identity
 * display. Deliberately mirrors the teacher AuthProvider's distinction
 * (ignores non-anonymous sessions) but as a plain query rather than a
 * context: RequireDevice/JoinPage/StudentShell all call this directly,
 * and TanStack Query dedupes the underlying request across them.
 */
export function useStudentSessionQuery() {
  return useQuery({
    queryKey: STUDENT_SESSION_QUERY_KEY,
    queryFn: async () => {
      const { data: sessionData } = await supabase.auth.getSession()
      const session = sessionData.session
      if (!session || session.user.is_anonymous !== true) return null

      const { data, error } = await supabase.rpc("get_my_student_session")
      if (error) throw error
      return data
    },
  })
}

/** Called after a successful join so RequireDevice/StudentShell pick up
 * the newly linked identity without a full page reload. */
export function useInvalidateStudentSession() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: STUDENT_SESSION_QUERY_KEY })
}
