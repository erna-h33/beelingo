import type { ClassOverviewStats } from "@/features/statistics/useClassStats"
import type { ClassStudentStat, ClassWordStat } from "@/lib/supabase/types"

export interface ClassReportInput {
  className: string
  learningLanguageName: string
  displayLanguageName: string
  overview: ClassOverviewStats
  wordStats: ClassWordStat[]
  studentStats: ClassStudentStat[]
}

/** jsPDF + jspdf-autotable are only ever needed here, so they're
 * dynamically imported -- no reason to add ~200kB to every route's
 * initial bundle for a feature only the Statistics page's Export button
 * touches. */
export async function exportClassReportPdf(input: ClassReportInput) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ])

  const doc = new jsPDF()
  const margin = 14
  let y = 20

  doc.setFontSize(18)
  doc.text(input.className, margin, y)
  y += 7

  doc.setFontSize(11)
  doc.setTextColor(100)
  doc.text(`${input.learningLanguageName} -> ${input.displayLanguageName}`, margin, y)
  y += 5
  doc.text(`Generated ${new Date().toLocaleDateString()}`, margin, y)
  y += 10

  doc.setTextColor(0)
  autoTable(doc, {
    startY: y,
    theme: "plain",
    styles: { fontSize: 10 },
    body: [
      ["Words in the Hive", String(input.overview.hiveWordCount)],
      ["Games played", String(input.overview.completedGameCount)],
      ["Student contributions", String(input.overview.contributionCount)],
      ["Active students", String(input.overview.activeStudentCount)],
    ],
  })
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10

  doc.setFontSize(13)
  doc.text("Most missed words", margin, y)
  y += 4
  autoTable(doc, {
    startY: y,
    head: [["Word", "Translation", "Attempts", "Miss rate"]],
    body: input.wordStats.map((w) => [
      w.word,
      w.translation ?? "",
      String(w.attempts),
      `${Math.round(w.missRate * 100)}%`,
    ]),
    styles: { fontSize: 10 },
    headStyles: { fillColor: [230, 180, 60] },
  })
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10

  doc.setFontSize(13)
  doc.text("Student progress", margin, y)
  y += 4
  autoTable(doc, {
    startY: y,
    head: [["Student", "Games played", "Accuracy", "Total score"]],
    body: input.studentStats.map((s) => {
      const total = s.correctCount + s.incorrectCount
      const accuracy = total > 0 ? `${Math.round((s.correctCount / total) * 100)}%` : "—"
      return [s.displayName, String(s.gamesPlayed), accuracy, String(s.totalScore)]
    }),
    styles: { fontSize: 10 },
    headStyles: { fillColor: [230, 180, 60] },
  })

  const safeName = input.className.trim().replace(/[^a-z0-9]+/gi, "-").toLowerCase()
  const date = new Date().toISOString().slice(0, 10)
  doc.save(`${safeName || "class"}-report-${date}.pdf`)
}
