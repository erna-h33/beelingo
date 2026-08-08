import { useQuery } from "@tanstack/react-query"

import { supabase } from "@/lib/supabase/client"
import type { Database } from "@/lib/supabase/types"

export type GameQuestion = Database["public"]["Tables"]["game_questions"]["Row"]

/** Discriminated payload shapes built by game_create_session (0019) --
 * kept here rather than in types.ts since question_payload is typed
 * loosely (Record<string, unknown>) at the DB layer and these are purely
 * a frontend convenience for narrowing it. */
export type QuestionPayload =
  | { type: "matching" | "memory_challenge"; pairs: { wordId: string; word: string; translation: string }[] }
  | { type: "flashcards"; word: string; translation: string | null }
  | { type: "typing_challenge"; prompt: string }
  | { type: "fill_in_blank"; sentence: string }
  | { type: "speed_translation" | "team_battle" | "reverse_translation"; prompt: string; choices: string[] }
  | {
      type: "beehive_recall"
      pairs: { wordId: string; word: string }[]
      displaySeconds: number
      answerSeconds: number
      pointsPerCorrect: number
    }

/**
 * game_questions rows for a session, RLS-gated by
 * `sequence_index <= game_sessions.current_question_index` -- students
 * only ever see revealed questions, teachers see all of them. The
 * `currentQuestionIndex` param is just a cache-key/refetch trigger (the
 * gating itself happens server-side); pass the live value from
 * useGameSessionQuery so a revealed question is refetched immediately
 * rather than waiting on some other invalidation.
 */
export function useGameQuestionsQuery(sessionId: string | undefined, currentQuestionIndex: number | undefined) {
  return useQuery({
    queryKey: ["games", sessionId, "questions", currentQuestionIndex],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("game_questions")
        .select("*")
        .eq("game_session_id", sessionId as string)
        .order("sequence_index", { ascending: true })
      if (error) throw error
      return data as GameQuestion[]
    },
    enabled: Boolean(sessionId) && currentQuestionIndex !== undefined,
  })
}
