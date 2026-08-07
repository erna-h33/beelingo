import { useQuery } from "@tanstack/react-query"

import { supabase } from "@/lib/supabase/client"
import type { ClassStudentStat, ClassWordStat } from "@/lib/supabase/types"

export function useClassWordStatsQuery(classId: string | undefined, limit = 10) {
  return useQuery({
    queryKey: ["classes", classId, "stats", "words", limit],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("class_word_stats", { p_class_id: classId as string, p_limit: limit })
      if (error) throw error
      return data as ClassWordStat[]
    },
    enabled: Boolean(classId),
  })
}

export function useClassStudentStatsQuery(classId: string | undefined) {
  return useQuery({
    queryKey: ["classes", classId, "stats", "students"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("class_student_stats", { p_class_id: classId as string })
      if (error) throw error
      return data as ClassStudentStat[]
    },
    enabled: Boolean(classId),
  })
}

export interface ClassOverviewStats {
  hiveWordCount: number
  completedGameCount: number
  contributionCount: number
  activeStudentCount: number
}

/** Simple counts, each a `head: true` count-only request -- cheap
 * enough at classroom scale that one RPC round trip per number isn't
 * worth trading away the readability of four plain PostgREST calls. */
export function useClassOverviewStatsQuery(classId: string | undefined) {
  return useQuery({
    queryKey: ["classes", classId, "stats", "overview"],
    queryFn: async (): Promise<ClassOverviewStats> => {
      const id = classId as string
      const [hiveWords, completedGames, contributions, activeStudents] = await Promise.all([
        supabase.from("hive_words").select("id", { count: "exact", head: true }).eq("class_id", id),
        supabase
          .from("game_sessions")
          .select("id", { count: "exact", head: true })
          .eq("class_id", id)
          .eq("status", "completed"),
        supabase.from("word_contributions").select("id", { count: "exact", head: true }).eq("class_id", id),
        supabase
          .from("class_students")
          .select("id", { count: "exact", head: true })
          .eq("class_id", id)
          .eq("is_active", true),
      ])
      if (hiveWords.error) throw hiveWords.error
      if (completedGames.error) throw completedGames.error
      if (contributions.error) throw contributions.error
      if (activeStudents.error) throw activeStudents.error
      return {
        hiveWordCount: hiveWords.count ?? 0,
        completedGameCount: completedGames.count ?? 0,
        contributionCount: contributions.count ?? 0,
        activeStudentCount: activeStudents.count ?? 0,
      }
    },
    enabled: Boolean(classId),
  })
}
