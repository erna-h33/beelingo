import { useEffect } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js"

import { supabase } from "@/lib/supabase/client"
import type { Database } from "@/lib/supabase/types"

export type GameSession = Database["public"]["Tables"]["game_sessions"]["Row"]
export type GameParticipant = Database["public"]["Tables"]["game_session_participants"]["Row"]

export function gameSessionQueryKey(sessionId: string | undefined) {
  return ["games", sessionId] as const
}

export function gameParticipantsQueryKey(sessionId: string | undefined) {
  return ["games", sessionId, "participants"] as const
}

/**
 * Session row (status, current_question_index) kept live via Postgres
 * Changes rather than polling -- see migration 0021's comment: this app
 * uses Postgres Changes for all state-related realtime instead of a
 * separate Broadcast channel, so this one subscription is what drives
 * both the teacher console advancing and every student screen reacting
 * to it.
 */
export function useGameSessionQuery(sessionId: string | undefined) {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: gameSessionQueryKey(sessionId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("game_sessions")
        .select("*")
        .eq("id", sessionId as string)
        .single()
      if (error) throw error
      return data as GameSession
    },
    enabled: Boolean(sessionId),
  })

  useEffect(() => {
    if (!sessionId) return

    const channel = supabase
      .channel(`game-session:${sessionId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "game_sessions", filter: `id=eq.${sessionId}` },
        (payload: RealtimePostgresChangesPayload<GameSession>) => {
          if (payload.new && "id" in payload.new) {
            queryClient.setQueryData(gameSessionQueryKey(sessionId), payload.new as GameSession)
          }
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [sessionId, queryClient])

  return query
}

/**
 * Live leaderboard. INSERT covers a student joining mid-waiting-room,
 * UPDATE covers score/team changes from game_submit_answer and
 * game_start_session's team assignment -- both just invalidate rather
 * than patch the cache directly, since the list also needs re-sorting
 * by score and that's simpler to leave to a refetch at classroom scale.
 */
export function useGameParticipantsQuery(sessionId: string | undefined) {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: gameParticipantsQueryKey(sessionId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("game_session_participants")
        .select("*")
        .eq("game_session_id", sessionId as string)
        .order("score", { ascending: false })
      if (error) throw error
      return data as GameParticipant[]
    },
    enabled: Boolean(sessionId),
  })

  useEffect(() => {
    if (!sessionId) return

    const channel = supabase
      .channel(`game-participants:${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "game_session_participants",
          filter: `game_session_id=eq.${sessionId}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: gameParticipantsQueryKey(sessionId) })
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [sessionId, queryClient])

  return query
}

function activeGameSessionQueryKey(classId: string | undefined) {
  return ["games", "active", classId] as const
}

/**
 * Resolves "is there a game already in progress for this class right
 * now" -- used on mount by both the teacher console (resume hosting
 * after a refresh) and the student game page (jump straight to the
 * waiting room/question instead of showing "waiting for teacher" when
 * one's already running). Only looks at waiting/active: once a session
 * completes, callers hang onto the id they already have in local state
 * rather than re-deriving it here, so the completed results screen
 * keeps working after this query stops returning it.
 */
export function useActiveGameSessionForClassQuery(classId: string | undefined) {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: activeGameSessionQueryKey(classId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("game_sessions")
        .select("*")
        .eq("class_id", classId as string)
        .in("status", ["waiting", "active"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return data as GameSession | null
    },
    enabled: Boolean(classId),
  })

  useEffect(() => {
    if (!classId) return

    const channel = supabase
      .channel(`game-sessions-for-class:${classId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "game_sessions", filter: `class_id=eq.${classId}` },
        () => {
          void queryClient.invalidateQueries({ queryKey: activeGameSessionQueryKey(classId) })
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [classId, queryClient])

  return query
}
