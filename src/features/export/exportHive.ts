import type { HiveWord } from "@/features/hive/useHiveWords"

import { downloadCsv, toCsv } from "./csv"

export type HiveExportFilter = "entire_hive" | "today" | "this_week" | "by_topic"

const SOURCE_LABEL: Record<HiveWord["source"], string> = {
  teacher: "Teacher",
  student: "Student",
  ocr: "Photo import",
}

function startOfToday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function startOfWeek() {
  const d = startOfToday()
  d.setDate(d.getDate() - d.getDay()) // back to Sunday
  return d
}

/** Always alphabetical -- exported lists are for reading/printing/study,
 * not "what got added most recently" (the Hive query's own default
 * order), regardless of which filter or format is picked. */
export function filterHiveWordsForExport(
  words: HiveWord[],
  filter: HiveExportFilter,
  topic?: string,
): HiveWord[] {
  const filtered = (() => {
    switch (filter) {
      case "today": {
        const since = startOfToday()
        return words.filter((w) => new Date(w.created_at) >= since)
      }
      case "this_week": {
        const since = startOfWeek()
        return words.filter((w) => new Date(w.created_at) >= since)
      }
      case "by_topic":
        return words.filter((w) => w.topic === topic)
      case "entire_hive":
      default:
        return words
    }
  })()
  return [...filtered].sort((a, b) => a.word.localeCompare(b.word))
}

const HEADERS = [
  "Word",
  "Translation",
  "Word Type",
  "Gender",
  "Plural",
  "Practice Sentence",
  "Topic",
  "Source",
  "Verified",
  "Date Added",
]

/** Shared by both export formats below -- CSV and PDF should never show
 * different data for the same word list, just a different container. */
function buildHiveRows(words: HiveWord[]): string[][] {
  return words.map((w) => [
    w.word,
    w.translation ?? "",
    w.word_type ?? "",
    w.gender ?? "",
    w.plural ?? "",
    w.practice_sentence ?? "",
    w.topic ?? "",
    SOURCE_LABEL[w.source],
    w.verified ? "Yes" : "No",
    new Date(w.created_at).toLocaleDateString(),
  ])
}

export function buildHiveCsv(words: HiveWord[]): string {
  return toCsv(HEADERS, buildHiveRows(words))
}

// The PDF is meant to be printed or shared as a study sheet, not a full
// data dump like the CSV -- Topic/Source/Verified/Date Added are
// bookkeeping a teacher or student reading it on paper doesn't need.
const PDF_HEADERS = ["Word", "Translation", "Word Type", "Gender", "Plural", "Practice Sentence"]

function buildHivePdfRows(words: HiveWord[]): string[][] {
  return words.map((w) => [
    w.word,
    w.translation ?? "",
    w.word_type ?? "",
    w.gender ?? "",
    w.plural ?? "",
    w.practice_sentence ?? "",
  ])
}

function hiveFileBase(className: string): string {
  const safeName = className.trim().replace(/[^a-z0-9]+/gi, "-").toLowerCase()
  const date = new Date().toISOString().slice(0, 10)
  return `${safeName || "hive"}-${date}`
}

export function exportHiveWords(className: string, words: HiveWord[]) {
  downloadCsv(`${hiveFileBase(className)}.csv`, buildHiveCsv(words))
}

/** jspdf/jspdf-autotable stay dynamically imported behind exportTablePdf
 * itself (see pdf.ts) -- this function doesn't need to know that, it
 * just hands over pre-shaped rows like exportClassReportPdf's caller
 * does. */
export async function exportHiveWordsPdf(className: string, words: HiveWord[]) {
  const { exportTablePdf } = await import("./pdf")
  await exportTablePdf({
    title: className,
    subtitle: `${words.length} word${words.length === 1 ? "" : "s"}`,
    headers: PDF_HEADERS,
    rows: buildHivePdfRows(words),
    filename: `${hiveFileBase(className)}.pdf`,
  })
}
