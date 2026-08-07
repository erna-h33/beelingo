import { useMutation, useQueryClient } from "@tanstack/react-query"

import { supabase } from "@/lib/supabase/client"
import type {
  GameAdvanceQuestionResult,
  GameCreateSessionResult,
  GameEndSessionResult,
  GameStartSessionResult,
  GameSubmitAnswerResult,
  GameType,
  WordSetFilter,
} from "@/lib/supabase/types"

import { gameParticipantsQueryKey, gameSessionQueryKey } from "./useGameSession"

export interface CreateGameSessionInput {
  classId: string
  gameType: GameType
  wordSetFilter: WordSetFilter
  questionCount: number
  topic?: string
  teamCount?: number
}

/** Teacher-only: builds the whole question set via weighted selection.
 * Not wired to any realtime invalidation since the caller navigates to
 * the freshly-created session's host console immediately after. */
export function useCreateGameSessionMutation() {
  return useMutation({
    mutationFn: async (input: CreateGameSessionInput) => {
      const settings: Record<string, unknown> = { questionCount: input.questionCount }
      if (input.topic) settings.topic = input.topic
      if (input.teamCount) settings.teamCount = input.teamCount

      const { data, error } = await supabase.rpc("game_create_session", {
        p_class_id: input.classId,
        p_game_type: input.gameType,
        p_word_set_filter: input.wordSetFilter,
        p_settings: settings,
      })
      if (error) throw error
      return data as GameCreateSessionResult
    },
  })
}

/** Teacher-only: waiting -> active, auto-balances Team Battle. The
 * session row update arrives to every client via useGameSessionQuery's
 * subscription, so no manual cache write is needed here beyond a
 * fallback invalidate for the caller's own optimistic-free UI. */
export function useStartGameSessionMutation(sessionId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("game_start_session", { p_session_id: sessionId })
      if (error) throw error
      return data as GameStartSessionResult
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: gameSessionQueryKey(sessionId) }),
  })
}

/** Teacher-only: bumps current_question_index, which is what actually
 * reveals the next question to student RLS reads. */
export function useAdvanceQuestionMutation(sessionId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("game_advance_question", { p_session_id: sessionId })
      if (error) throw error
      return data as GameAdvanceQuestionResult
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: gameSessionQueryKey(sessionId) }),
  })
}

export interface SubmitAnswerInput {
  gameQuestionId: string
  participantId: string
  submittedAnswer: Record<string, unknown>
  responseTimeMs?: number
}

/** Student-only: grading always happens server-side (see 0019/0020's
 * comments) -- the returned isCorrect/pointsAwarded is server truth, not
 * an echo of anything the client asserted. */
export function useSubmitAnswerMutation() {
  return useMutation({
    mutationFn: async (input: SubmitAnswerInput) => {
      const { data, error } = await supabase.rpc("game_submit_answer", {
        p_game_question_id: input.gameQuestionId,
        p_participant_id: input.participantId,
        p_submitted_answer: input.submittedAnswer,
        p_response_time_ms: input.responseTimeMs ?? null,
      })
      if (error) throw error
      return data as GameSubmitAnswerResult
    },
  })
}

/** Teacher-only: marks the session completed and triggers the adaptive
 * mastery-score update for every word touched this game. */
export function useEndGameSessionMutation(sessionId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("game_end_session", { p_session_id: sessionId })
      if (error) throw error
      return data as GameEndSessionResult
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: gameSessionQueryKey(sessionId) })
      queryClient.invalidateQueries({ queryKey: gameParticipantsQueryKey(sessionId) })
    },
  })
}

export interface JoinGameSessionInput {
  sessionId: string
  classStudentId: string
}

/** Student-only self-join: RLS restricts the insert to
 * `class_student_id = current_class_student_id()` (0018). Uses
 * upsert-like "select existing, else insert" since a student may
 * reload/rejoin the same session (e.g. after a dropped connection). */
export function useJoinGameSessionMutation() {
  return useMutation({
    mutationFn: async (input: JoinGameSessionInput) => {
      const { data: existing, error: selectError } = await supabase
        .from("game_session_participants")
        .select("*")
        .eq("game_session_id", input.sessionId)
        .eq("class_student_id", input.classStudentId)
        .maybeSingle()
      if (selectError) throw selectError
      if (existing) return existing

      const { data, error } = await supabase
        .from("game_session_participants")
        .insert({ game_session_id: input.sessionId, class_student_id: input.classStudentId })
        .select()
        .single()
      if (error) throw error
      return data
    },
  })
}
