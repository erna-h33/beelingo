import { supabase } from "@/lib/supabase/client"
import { insertHiveWord } from "@/features/hive/useHiveWords"
import type { EnrichWordResult } from "@/features/hive/useEnrichWord"

export interface BatchImportContext {
  classId: string
  learningLanguageCode: string
  deeplSourceCode: string | null
  deeplTargetCode: string | null
}

export interface BatchImportResult {
  word: string
  status: "created" | "duplicate" | "failed"
  errorMessage?: string
}

/**
 * Imports OCR-accepted words one at a time: best-effort enrichment (a
 * failure here never blocks the import -- the word still gets created,
 * just without translation/lexical data, same as manual entry with
 * enrichment unavailable) followed by the same insert manual entry
 * uses, tagged `source: 'ocr'`. Sequential rather than parallel, both to
 * keep a simple per-word progress callback and to avoid bursting
 * DeepL/Wikidata with a pile of concurrent requests for what's usually
 * a classroom-scale (tens of words) batch.
 */
export async function importWordsFromOcr(
  words: string[],
  context: BatchImportContext,
  onProgress?: (completed: number, total: number) => void,
): Promise<BatchImportResult[]> {
  const results: BatchImportResult[] = []

  for (let i = 0; i < words.length; i++) {
    const word = words[i]
    try {
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

      await insertHiveWord({
        classId: context.classId,
        word,
        translation: enrichment?.translation ?? undefined,
        wordType: enrichment?.wordType ?? undefined,
        gender: enrichment?.gender ?? undefined,
        plural: enrichment?.plural ?? undefined,
        source: "ocr",
        translationSource: enrichment?.translationSource ?? "none",
        lexicalSource: enrichment?.lexicalSource ?? "none",
        enrichmentStatus: enrichment?.enrichmentStatus ?? "failed",
      })
      results.push({ word, status: "created" })
    } catch (error) {
      const code = (error as { code?: string } | null)?.code
      if (code === "23505") {
        results.push({ word, status: "duplicate" })
      } else {
        results.push({
          word,
          status: "failed",
          errorMessage: error instanceof Error ? error.message : undefined,
        })
      }
    }
    onProgress?.(i + 1, words.length)
  }

  return results
}
