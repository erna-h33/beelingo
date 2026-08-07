import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { supabase } from "@/lib/supabase/client"

export interface LanguageRef {
  id: string
  code: string
  name: string
  flag_emoji: string | null
  deepl_source_code: string | null
  deepl_target_code: string | null
}

export interface ClassSummary {
  id: string
  name: string
  class_code: string
  created_at: string
  archived_at: string | null
  learning_language: LanguageRef
  display_language: LanguageRef
  class_students: { id: string; is_active: boolean }[]
}

const CLASS_SELECT = `
  id, name, class_code, created_at, archived_at,
  learning_language:languages!classes_learning_language_id_fkey(id, code, name, flag_emoji, deepl_source_code, deepl_target_code),
  display_language:languages!classes_display_language_id_fkey(id, code, name, flag_emoji, deepl_source_code, deepl_target_code),
  class_students(id, is_active)
`

/** Active (non-archived) classes owned by the signed-in teacher. */
export function useClassesQuery() {
  return useQuery({
    queryKey: ["classes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classes")
        .select(CLASS_SELECT)
        .is("archived_at", null)
        .order("created_at", { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as ClassSummary[]
    },
  })
}

export function useClassQuery(classId: string | undefined) {
  return useQuery({
    queryKey: ["classes", classId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classes")
        .select(CLASS_SELECT)
        .eq("id", classId as string)
        .single()
      if (error) throw error
      return data as unknown as ClassSummary
    },
    enabled: Boolean(classId),
  })
}

interface CreateClassInput {
  teacherId: string
  name: string
  learningLanguageId: string
  displayLanguageId: string
}

export function useCreateClassMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateClassInput) => {
      const { data, error } = await supabase
        .from("classes")
        .insert({
          teacher_id: input.teacherId,
          name: input.name,
          learning_language_id: input.learningLanguageId,
          display_language_id: input.displayLanguageId,
        })
        .select("id")
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classes"] })
    },
  })
}

interface UpdateClassInput {
  classId: string
  name: string
  learningLanguageId: string
  displayLanguageId: string
}

export function useUpdateClassMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: UpdateClassInput) => {
      const { error } = await supabase
        .from("classes")
        .update({
          name: input.name,
          learning_language_id: input.learningLanguageId,
          display_language_id: input.displayLanguageId,
        })
        .eq("id", input.classId)
      if (error) throw error
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["classes"] })
      queryClient.invalidateQueries({ queryKey: ["classes", variables.classId] })
    },
  })
}

/** "Delete Class" archives rather than hard-deletes, preserving history
 * (roster, and future contributions/game data) tied to the class. */
export function useArchiveClassMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (classId: string) => {
      const { error } = await supabase
        .from("classes")
        .update({ archived_at: new Date().toISOString() })
        .eq("id", classId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classes"] })
    },
  })
}
