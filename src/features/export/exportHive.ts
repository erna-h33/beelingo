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

export function filterHiveWordsForExport(
  words: HiveWord[],
  filter: HiveExportFilter,
  topic?: string,
): HiveWord[] {
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

export function buildHiveCsv(words: HiveWord[]): string {
  const rows = words.map((w) => [
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
  return toCsv(HEADERS, rows)
}

export function exportHiveWords(className: string, words: HiveWord[]) {
  const csv = buildHiveCsv(words)
  const safeName = className.trim().replace(/[^a-z0-9]+/gi, "-").toLowerCase()
  const date = new Date().toISOString().slice(0, 10)
  downloadCsv(`${safeName || "hive"}-${date}.csv`, csv)
}
