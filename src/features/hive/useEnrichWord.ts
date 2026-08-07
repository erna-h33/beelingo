import { useMutation } from "@tanstack/react-query"

import { supabase } from "@/lib/supabase/client"

export interface EnrichWordResult {
  translation: string | null
  translationSource: "deepl" | "none"
  wordType: string | null
  gender: string | null
  plural: string | null
  lexicalSource: "wikidata" | "none"
  enrichmentStatus: "success" | "partial" | "failed"
}

interface EnrichWordInput {
  word: string
  learningLanguageCode: string
  deeplSourceCode: string | null
  deeplTargetCode: string | null
}

/**
 * Calls the `enrich-word` Edge Function (DeepL translation + Wikidata
 * lexical lookup -- see supabase/functions/enrich-word/index.ts). Purely
 * additive: the caller pre-fills whatever comes back into the (still
 * fully editable) add-word form. If the function isn't deployed yet, or
 * DeepL/Wikidata don't have anything for this word, this just fails or
 * returns blanks -- creating a word manually never depends on it.
 */
export function useEnrichWordMutation() {
  return useMutation({
    mutationFn: async (input: EnrichWordInput) => {
      const { data, error } = await supabase.functions.invoke<EnrichWordResult>("enrich-word", {
        body: input,
      })
      if (error) throw error
      return data
    },
  })
}
