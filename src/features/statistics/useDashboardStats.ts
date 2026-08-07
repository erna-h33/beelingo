import { useQuery } from "@tanstack/react-query"

import { supabase } from "@/lib/supabase/client"
import type { StudentDashboardStats, TeacherDashboardStats } from "@/lib/supabase/types"

export function useTeacherDashboardStatsQuery() {
  return useQuery({
    queryKey: ["teacherDashboardStats"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("teacher_dashboard_stats")
      if (error) throw error
      return data as TeacherDashboardStats
    },
  })
}

export function useStudentDashboardStatsQuery(enabled: boolean) {
  return useQuery({
    queryKey: ["studentDashboardStats"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("student_dashboard_stats")
      if (error) throw error
      return data as StudentDashboardStats
    },
    enabled,
  })
}
