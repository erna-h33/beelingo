import { useMutation } from "@tanstack/react-query"

import { supabase } from "@/lib/supabase/client"
import { useInvalidateStudentSession } from "./useStudentSession"

/** Step 1 of the join flow: look up a class + its active roster by code.
 * No session required -- a curious QR scan that never finishes joining
 * never creates a throwaway anonymous auth user (see
 * migrations/0010_student_join_functions.sql). */
export function useLookupClassByCode() {
  return useMutation({
    mutationFn: async (classCode: string) => {
      const { data, error } = await supabase.rpc("lookup_class_by_code", {
        p_class_code: classCode,
      })
      if (error) throw error
      if (!data) throw new Error("We couldn't find a class with that code.")
      return data
    },
  })
}

/** Step 2: pick a name from the roster. Ensures an anonymous session
 * exists (creating one on first join), then links it to the chosen
 * roster entry via the `join_class` RPC. */
export function useJoinClassMutation() {
  const invalidateStudentSession = useInvalidateStudentSession()

  return useMutation({
    mutationFn: async (classStudentId: string) => {
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData.session) {
        const { error: signInError } = await supabase.auth.signInAnonymously()
        if (signInError) throw signInError
      }

      const { data, error } = await supabase.rpc("join_class", {
        p_class_student_id: classStudentId,
      })
      if (error) throw error
      return data
    },
    // Returning (not just calling) invalidateStudentSession() matters:
    // useMutation awaits whatever onSuccess returns before considering
    // the mutation settled, so mutateAsync() in JoinPage's
    // handlePickName won't resolve -- and navigate("/s") won't fire --
    // until the session query has actually refetched. Without the
    // `return`, invalidation was fire-and-forget: navigation could beat
    // the refetch, and RequireDevice would see the still-stale cached
    // `session: null` (isLoading is only true on a query's very first
    // fetch, not a background refetch of already-cached data) and
    // immediately bounce back to /join.
    onSuccess: () => invalidateStudentSession(),
  })
}
