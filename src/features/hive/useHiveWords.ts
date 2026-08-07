import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { supabase } from "@/lib/supabase/client"
import type { Database } from "@/lib/supabase/types"

export type HiveWord = Database["public"]["Tables"]["hive_words"]["Row"]

function invalidateHive(queryClient: ReturnType<typeof useQueryClient>, classId: string) {
  queryClient.invalidateQueries({ queryKey: ["classes", classId, "hive"] })
}

export function useHiveWordsQuery(classId: string | undefined) {
  return useQuery({
    queryKey: ["classes", classId, "hive"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hive_words")
        .select("*")
        .eq("class_id", classId as string)
        .order("created_at", { ascending: false })
      if (error) throw error
      return data as HiveWord[]
    },
    enabled: Boolean(classId),
  })
}

interface CreateHiveWordInput {
  classId: string
  word: string
  translation?: string
  wordType?: string
  gender?: string
  plural?: string
  topic?: string
  practiceSentence?: string
  teacherNotes?: string
  translationSource?: "deepl" | "manual" | "none"
  lexicalSource?: "wikidata" | "none"
  enrichmentStatus?: "pending" | "success" | "partial" | "failed"
}

export function useCreateHiveWordMutation(classId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateHiveWordInput) => {
      const now = new Date().toISOString()
      const { data, error } = await supabase
        .from("hive_words")
        .insert({
          class_id: input.classId,
          word: input.word,
          translation: input.translation || null,
          word_type: input.wordType || null,
          gender: input.gender || null,
          plural: input.plural || null,
          topic: input.topic || null,
          practice_sentence: input.practiceSentence || null,
          teacher_notes: input.teacherNotes || null,
          source: "teacher",
          translation_source: input.translationSource ?? (input.translation ? "manual" : "none"),
          translated_at: input.translation ? now : null,
          lexical_source: input.lexicalSource ?? "none",
          lexical_fetched_at: input.lexicalSource === "wikidata" ? now : null,
          enrichment_status: input.enrichmentStatus ?? "pending",
        })
        .select()
        .single()
      if (error) throw error
      return data as HiveWord
    },
    onSuccess: () => invalidateHive(queryClient, classId),
  })
}

interface UpdateHiveWordInput {
  id: string
  word: string
  translation?: string
  wordType?: string
  gender?: string
  plural?: string
  topic?: string
  practiceSentence?: string
  teacherNotes?: string
}

export function useUpdateHiveWordMutation(classId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: UpdateHiveWordInput) => {
      const { error } = await supabase
        .from("hive_words")
        .update({
          word: input.word,
          translation: input.translation || null,
          word_type: input.wordType || null,
          gender: input.gender || null,
          plural: input.plural || null,
          topic: input.topic || null,
          practice_sentence: input.practiceSentence || null,
          teacher_notes: input.teacherNotes || null,
        })
        .eq("id", input.id)
      if (error) throw error
    },
    onSuccess: () => invalidateHive(queryClient, classId),
  })
}

export function useSetVerifiedMutation(classId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, verified }: { id: string; verified: boolean }) => {
      const { error } = await supabase
        .from("hive_words")
        .update({ verified, verified_at: verified ? new Date().toISOString() : null })
        .eq("id", id)
      if (error) throw error
    },
    onSuccess: () => invalidateHive(queryClient, classId),
  })
}

export function useDeleteHiveWordMutation(classId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("hive_words").delete().eq("id", id)
      if (error) throw error
    },
    onSuccess: () => invalidateHive(queryClient, classId),
  })
}
