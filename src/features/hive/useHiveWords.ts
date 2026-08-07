import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { supabase } from "@/lib/supabase/client"
import type { Database } from "@/lib/supabase/types"

export type HiveWord = Database["public"]["Tables"]["hive_words"]["Row"]

function invalidateHive(queryClient: ReturnType<typeof useQueryClient>, classId: string) {
  queryClient.invalidateQueries({ queryKey: ["classes", classId, "hive"] })
}

/** Refetches the Hive list after something outside a mutation hook
 * changes it -- e.g. the OCR batch import, which inserts many rows in a
 * loop and invalidates once at the end rather than per row. */
export function useInvalidateHive(classId: string) {
  const queryClient = useQueryClient()
  return () => invalidateHive(queryClient, classId)
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

export interface CreateHiveWordInput {
  classId: string
  word: string
  translation?: string
  wordType?: string
  gender?: string
  plural?: string
  topic?: string
  practiceSentence?: string
  teacherNotes?: string
  /** Defaults to "teacher" -- the OCR import flow passes "ocr" instead. */
  source?: HiveWord["source"]
  translationSource?: "deepl" | "manual" | "none"
  lexicalSource?: "wikidata" | "none"
  enrichmentStatus?: "pending" | "success" | "partial" | "failed"
}

/** Plain insert, reused by both the single-word mutation below and the
 * OCR batch import (which calls this directly in a loop and invalidates
 * once at the end, rather than spinning up a mutation per word). */
export async function insertHiveWord(input: CreateHiveWordInput): Promise<HiveWord> {
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
      source: input.source ?? "teacher",
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
}

export function useCreateHiveWordMutation(classId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: insertHiveWord,
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
