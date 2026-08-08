import { useEffect } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"

import { supabase } from "@/lib/supabase/client"

export interface GameAnswerRow {
  id: string
  game_session_participant_id: string
  submitted_answer: Record<string, unknown> | null
  is_correct: boolean
}

/**
 * Live "N answered" count for the currently-revealed question, so the
 * teacher can see the room catching up before hitting Next. Reads
 * game_answers (teacher SELECT policy allows it, 0018) -- never
 * game_question_answers, which stays server-only.
 *
 * Counts distinct participants, not rows: for single-target questions
 * (one row per participant) that's the same number either way, but
 * pairs-style questions -- Matching/Memory Challenge, and now BeeHive
 * Recall -- can have several rows per participant (one per pair/word
 * attempted), so a raw row count would overcount how many students have
 * actually taken part.
 */
export function useAnsweredCountQuery(gameQuestionId: string | undefined) {
  const queryClient = useQueryClient()
  const queryKey = ["games", "questions", gameQuestionId, "answeredCount"] as const

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("game_answers")
        .select("game_session_participant_id")
        .eq("game_question_id", gameQuestionId as string)
      if (error) throw error
      return new Set((data ?? []).map((row) => row.game_session_participant_id)).size
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

/**
 * Every game_answers row for a question -- used by BeeHive Recall's
 * results view (Words Correct/Missed for the current student, "Most
 * Forgotten Word" across the whole class) once the session is
 * completed. Deliberately not scoped to "my own answers": both the
 * teacher and student SELECT policies on game_answers (0018) already
 * grant whole-class visibility for a shared game, which is exactly what
 * the class-wide aggregate needs -- no new RPC, just reading a table
 * that's already readable.
 */
export function useGameAnswersForQuestionQuery(gameQuestionId: string | undefined) {
  const queryClient = useQueryClient()
  const queryKey = ["games", "questions", gameQuestionId, "answers"] as const

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("game_answers")
        .select("id, game_session_participant_id, submitted_answer, is_correct")
        .eq("game_question_id", gameQuestionId as string)
      if (error) throw error
      return data as GameAnswerRow[]
    },
    enabled: Boolean(gameQuestionId),
  })

  // Same realtime-invalidation need as useAnsweredCountQuery above, and
  // for the same reason: without it, whichever client fetched this
  // before any (or the most recent) submission landed just keeps
  // showing that stale snapshot -- the default 30s staleTime means it
  // won't refetch on its own in time for the results screen.
  useEffect(() => {
    if (!gameQuestionId) return

    const channel = supabase
      .channel(`game-answers-full:${gameQuestionId}`)
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
