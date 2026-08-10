import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { supabase } from "@/lib/supabase/client"
import type { EnrichWordResult } from "@/features/hive/useEnrichWord"
import { STUDENT_SESSION_QUERY_KEY } from "@/features/studentSession/useStudentSession"

export interface MyContribution {
  id: string
  contributedAt: string
  isFirstContribution: boolean
  hiveWordId: string
  word: string
  translation: string | null
  wordType: string | null
  gender: string | null
  plural: string | null
  topic: string | null
  practiceSentence: string | null
}

interface MyContributionHiveWordRow {
  id: string
  word: string
  translation: string | null
  word_type: string | null
  gender: string | null
  plural: string | null
  topic: string | null
  practice_sentence: string | null
}

/** Every word this student has contributed (first-time or reinforcing),
 * newest first -- the "My Contributions" checklist. Pulls every field
 * the self-edit dialog needs (not just word/translation) so editing
 * doesn't need a second round-trip. */
export function useMyContributionsQuery(classStudentId: string | undefined) {
  return useQuery({
    queryKey: ["studentSession", classStudentId, "contributions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("word_contributions")
        .select(
          "id, contributed_at, is_first_contribution, hive_words(id, word, translation, word_type, gender, plural, topic, practice_sentence)",
        )
        .eq("class_student_id", classStudentId as string)
        .order("contributed_at", { ascending: false })
      if (error) throw error
      return (data ?? []).map((row) => {
        const hiveWord = row.hive_words as unknown as MyContributionHiveWordRow | null
        return {
          id: row.id,
          contributedAt: row.contributed_at,
          isFirstContribution: row.is_first_contribution,
          hiveWordId: hiveWord?.id ?? "",
          word: hiveWord?.word ?? "",
          translation: hiveWord?.translation ?? null,
          wordType: hiveWord?.word_type ?? null,
          gender: hiveWord?.gender ?? null,
          plural: hiveWord?.plural ?? null,
          topic: hiveWord?.topic ?? null,
          practiceSentence: hiveWord?.practice_sentence ?? null,
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

/** A friendlier message for the one PostgREST error code both mutations
 * below can hit purely from RLS silently filtering out a row the
 * student no longer (or never did) have edit rights on -- see
 * migrations/0033_students_edit_own_hive_words.sql's sole-contributor
 * rule. `.select().single()` is what turns "0 rows touched" into an
 * actual catchable error in the first place; without it, a blocked
 * update/delete against a Postgres RLS policy just silently affects
 * nothing and still reports success. */
function friendlyEditError(error: unknown): Error {
  const code = (error as { code?: string } | null)?.code
  if (code === "PGRST116") {
    return new Error("You can only edit or delete a word you added, and only if no one else has added it too.")
  }
  if (code === "23505") {
    return new Error("That word is already in the Hive.")
  }
  return error instanceof Error ? error : new Error("Something went wrong.")
}

export interface UpdateMyWordInput {
  hiveWordId: string
  word: string
  translation?: string
  wordType?: string
  gender?: string
  plural?: string
  topic?: string
  practiceSentence?: string
}

/** Lets a student fix their own contribution -- gated entirely by RLS
 * (migrations/0033_students_edit_own_hive_words.sql), not anything
 * client-side: only their own words, and only ones nobody else has
 * since contributed to. */
export function useUpdateMyWordMutation(classStudentId: string | undefined, classId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: UpdateMyWordInput) => {
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
        })
        .eq("id", input.hiveWordId)
        .select()
        .single()
      if (error) throw friendlyEditError(error)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["studentSession", classStudentId, "contributions"] })
      queryClient.invalidateQueries({ queryKey: ["classes", classId, "hive"] })
    },
  })
}

/** Deleting the hive_words row cascades to every word_contributions row
 * for it (including any other student's, but RLS already guarantees
 * there are none by the time this succeeds -- see the sole-contributor
 * check above), so no separate contribution-row cleanup is needed. */
export function useDeleteMyWordMutation(classStudentId: string | undefined, classId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (hiveWordId: string) => {
      const { error } = await supabase.from("hive_words").delete().eq("id", hiveWordId).select().single()
      if (error) throw friendlyEditError(error)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["studentSession", classStudentId, "contributions"] })
      queryClient.invalidateQueries({ queryKey: ["classes", classId, "hive"] })
    },
  })
}
