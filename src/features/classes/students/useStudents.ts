import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { supabase } from "@/lib/supabase/client"

export interface RosterStudent {
  id: string
  class_id: string
  display_name: string
  is_active: boolean
  joined_at: string
}

export function useStudentsQuery(classId: string | undefined) {
  return useQuery({
    queryKey: ["classes", classId, "students"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("class_students")
        .select("*")
        .eq("class_id", classId as string)
        .order("is_active", { ascending: false })
        .order("display_name", { ascending: true })
      if (error) throw error
      return data as RosterStudent[]
    },
    enabled: Boolean(classId),
  })
}

function invalidateRoster(queryClient: ReturnType<typeof useQueryClient>, classId: string) {
  queryClient.invalidateQueries({ queryKey: ["classes", classId, "students"] })
  // student counts shown on the classes list/summary also need a refresh
  queryClient.invalidateQueries({ queryKey: ["classes"] })
}

export function useAddStudentsMutation(classId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (displayNames: string[]) => {
      const rows = displayNames
        .map((name) => name.trim())
        .filter(Boolean)
        .map((display_name) => ({ class_id: classId, display_name }))
      if (rows.length === 0) return []
      const { data, error } = await supabase.from("class_students").insert(rows).select()
      if (error) throw error
      return data
    },
    onSuccess: () => invalidateRoster(queryClient, classId),
  })
}

export function useRenameStudentMutation(classId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ studentId, displayName }: { studentId: string; displayName: string }) => {
      const { error } = await supabase
        .from("class_students")
        .update({ display_name: displayName })
        .eq("id", studentId)
      if (error) throw error
    },
    onSuccess: () => invalidateRoster(queryClient, classId),
  })
}

/** "Remove"/"Restore" toggle `is_active` rather than deleting the row, so
 * any future contributions/game history tied to this roster entry is
 * preserved. */
export function useSetStudentActiveMutation(classId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ studentId, isActive }: { studentId: string; isActive: boolean }) => {
      const { error } = await supabase
        .from("class_students")
        .update({ is_active: isActive })
        .eq("id", studentId)
      if (error) throw error
    },
    onSuccess: () => invalidateRoster(queryClient, classId),
  })
}
