import { createWorker } from "tesseract.js"

/**
 * Runs OCR on a photo entirely client-side (tesseract.js's own worker
 * abstraction keeps this off the main thread -- no manual Worker setup
 * needed). `onProgress` receives 0-1 during the actual recognition pass.
 */
export async function extractTextFromImage(
  file: File,
  tesseractLangCode: string,
  onProgress?: (progress: number) => void,
): Promise<string> {
  const worker = await createWorker(tesseractLangCode, undefined, {
    logger: (message) => {
      if (message.status === "recognizing text") {
        onProgress?.(message.progress)
      }
    },
  })
  try {
    const {
      data: { text },
    } = await worker.recognize(file)
    return text
  } finally {
    await worker.terminate()
  }
}

/**
 * Turns raw OCR text into a deduplicated list of candidate words/lines
 * for the review screen. A photographed vocabulary list is naturally
 * one entry per line, so this splits on lines (not whitespace within a
 * line) -- otherwise a multi-word phrase like "in front of" would get
 * wrongly split into three bogus single-word candidates. Leading
 * numbering/bullets ("1.", "2)", "-", "•") are stripped since they're
 * common in photographed lists and never part of the word itself.
 */
export function textToCandidateWords(rawText: string): string[] {
  const seen = new Set<string>()
  const candidates: string[] = []

  for (const rawLine of rawText.split("\n")) {
    const cleaned = rawLine
      .replace(/^\s*\d+[.)]\s*/, "")
      .replace(/^[•\-*]\s*/, "")
      .trim()
    if (!cleaned) continue

    const key = cleaned.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    candidates.push(cleaned)
  }

  return candidates
}
