import { useEffect } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"

import { supabase } from "@/lib/supabase/client"

/**
 * Live "N answered" count for the currently-revealed question, so the
 * teacher can see the room catching up before hitting Next. Reads
 * game_answers (teacher SELECT policy allows it, 0018) -- never
 * game_question_answers, which stays server-only.
 */
export function useAnsweredCountQuery(gameQuestionId: string | undefined) {
  const queryClient = useQueryClient()
  const queryKey = ["games", "questions", gameQuestionId, "answeredCount"] as const

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("game_answers")
        .select("id", { count: "exact", head: true })
        .eq("game_question_id", gameQuestionId as string)
      if (error) throw error
      return count ?? 0
    },
    enabled: Boolean(gameQuestionId),
  })

  useEffect(() => {
    if (!gameQuestionId) return

    const channel = supabase
      .channel(`game-answers:${gameQuestionId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "game_answers", filter: `game_question_id=eq.${gameQuestionId}` },
        () => {
          void queryClient.invalidateQueries({ queryKey })
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- queryKey is derived from gameQuestionId
  }, [gameQuestionId, queryClient])

  return query
}
