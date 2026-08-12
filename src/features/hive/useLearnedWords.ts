import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { supabase } from "@/lib/supabase/client"

function learnedWordsQueryKey(classStudentId: string | undefined) {
  return ["studentSession", classStudentId, "learnedWords"]
}

/** Every hive_word_id this student has personally checked off as
 * "learned" -- a plain Set, since the UI only ever needs a fast
 * membership check per word card. Purely private/self-contained: see
 * migration 0035 for why this never touches the teacher side or the
 * game engine. */
export function useLearnedWordsQuery(classStudentId: string | undefined) {
  return useQuery({
    queryKey: learnedWordsQueryKey(classStudentId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("student_learned_words")
        .select("hive_word_id")
        .eq("class_student_id", classStudentId as string)
      if (error) throw error
      return new Set(data.map((row) => row.hive_word_id))
    },
    enabled: Boolean(classStudentId),
  })
}

/** Toggling "learned" is an insert-or-delete, not a boolean flip --
 * there's no row to update, just one to create or remove (see
 * migration 0035). */
export function useToggleLearnedWordMutation(classStudentId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ hiveWordId, learned }: { hiveWordId: string; learned: boolean }) => {
      if (!classStudentId) throw new Error("Not recognized as a student in any class")
      if (learned) {
        const { error } = await supabase
          .from("student_learned_words")
          .insert({ class_student_id: classStudentId, hive_word_id: hiveWordId })
        if (error) throw error
      } else {
        const { error } = await supabase
          .from("student_learned_words")
          .delete()
          .eq("class_student_id", classStudentId)
          .eq("hive_word_id", hiveWordId)
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: learnedWordsQueryKey(classStudentId) })
    },
  })
}
