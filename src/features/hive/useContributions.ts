import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { supabase } from "@/lib/supabase/client"
import type { EnrichWordResult } from "@/features/hive/useEnrichWord"
import { STUDENT_SESSION_QUERY_KEY } from "@/features/studentSession/useStudentSession"

export interface MyContribution {
  id: string
  contributedAt: string
  isFirstContribution: boolean
  word: string
  translation: string | null
}

/** Every word this student has contributed (first-time or reinforcing),
 * newest first -- the "My Contributions" checklist. */
export function useMyContributionsQuery(classStudentId: string | undefined) {
  return useQuery({
    queryKey: ["studentSession", classStudentId, "contributions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("word_contributions")
        .select("id, contributed_at, is_first_contribution, hive_words(word, translation)")
        .eq("class_student_id", classStudentId as string)
        .order("contributed_at", { ascending: false })
      if (error) throw error
      return (data ?? []).map((row) => {
        const hiveWord = row.hive_words as unknown as { word: string; translation: string | null }
        return {
          id: row.id,
          contributedAt: row.contributed_at,
          isFirstContribution: row.is_first_contribution,
          word: hiveWord?.word ?? "",
          translation: hiveWord?.translation ?? null,
        } satisfies MyContribution
      })
    },
    enabled: Boolean(classStudentId),
  })
}

interface ContributeWordContext {
  learningLanguageCode: string
  deeplSourceCode: string | null
  deeplTargetCode: string | null
}

/**
 * "What new word did you learn today?" -- attempts enrichment first
 * (stateless, safe even if the word turns out to already exist), then
 * calls the contribute_word RPC, which atomically finds-or-creates the
 * Hive entry and logs the contribution. See
 * supabase/migrations/0014_word_contributions.sql.
 */
export function useContributeWordMutation(classStudentId: string | undefined, classId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ word, context }: { word: string; context: ContributeWordContext }) => {
      let enrichment: EnrichWordResult | null = null
      try {
        const { data } = await supabase.functions.invoke<EnrichWordResult>("enrich-word", {
          body: {
            word,
            learningLanguageCode: context.learningLanguageCode,
            deeplSourceCode: context.deeplSourceCode,
            deeplTargetCode: context.deeplTargetCode,
          },
        })
        enrichment = data ?? null
      } catch {
        enrichment = null
      }

      const { data, error } = await supabase.rpc("contribute_word", {
        p_word: word,
        p_translation: enrichment?.translation ?? null,
        p_word_type: enrichment?.wordType ?? null,
        p_gender: enrichment?.gender ?? null,
        p_plural: enrichment?.plural ?? null,
        p_translation_source: enrichment?.translationSource ?? "none",
        p_lexical_source: enrichment?.lexicalSource ?? "none",
        p_enrichment_status: enrichment?.enrichmentStatus ?? "failed",
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["studentSession", classStudentId, "contributions"] })
      // a brand-new word changes the class Hive list; either way the
      // student's own session-scoped stats potentially changed too
      queryClient.invalidateQueries({ queryKey: ["classes", classId, "hive"] })
      queryClient.invalidateQueries({ queryKey: STUDENT_SESSION_QUERY_KEY })
    },
  })
}
