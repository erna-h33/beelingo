import { useState } from "react"
import { useParams } from "react-router-dom"
import { Download, Gamepad2, Hexagon, Loader2, MessageSquarePlus, Users } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useClassQuery } from "@/features/classes/useClasses"
import { exportClassReportPdf } from "@/features/export/pdf"
import { MostMissedWordsChart } from "@/features/statistics/components/MostMissedWordsChart"
import { StatCard } from "@/features/statistics/components/StatCard"
import { StudentProgressTable } from "@/features/statistics/components/StudentProgressTable"
import {
  useClassOverviewStatsQuery,
  useClassStudentStatsQuery,
  useClassWordStatsQuery,
} from "@/features/statistics/useClassStats"

export default function ClassStatisticsPage() {
  const { classId } = useParams<{ classId: string }>()
  const { data: classItem } = useClassQuery(classId)
  const { data: overview, isLoading: overviewLoading } = useClassOverviewStatsQuery(classId)
  const { data: wordStats, isLoading: wordStatsLoading } = useClassWordStatsQuery(classId)
  const { data: studentStats, isLoading: studentStatsLoading } = useClassStudentStatsQuery(classId)
  const [exporting, setExporting] = useState(false)

  const statsReady = !overviewLoading && !wordStatsLoading && !studentStatsLoading && Boolean(classItem && overview)

  async function handleExportPdf() {
    if (!classItem || !overview) return
    setExporting(true)
    try {
      await exportClassReportPdf({
        className: classItem.name,
        learningLanguageName: classItem.learning_language.name,
        displayLanguageName: classItem.display_language.name,
        overview,
        wordStats: wordStats ?? [],
        studentStats: studentStats ?? [],
      })
    } catch (error) {
      toast.error("Couldn't generate the PDF", {
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setExporting(false)
    }
  }

  if (!classId) return null

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold">Statistics</h2>
          <p className="text-sm text-muted-foreground">
            How the class is doing -- nothing here is a grade, just a pulse check.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={handleExportPdf} disabled={!statsReady || exporting}>
          {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
          Export PDF report
        </Button>
      </div>

      {overviewLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[68px]" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard icon={Hexagon} label="Words in the Hive" value={overview?.hiveWordCount ?? 0} />
          <StatCard icon={Gamepad2} label="Games played" value={overview?.completedGameCount ?? 0} />
          <StatCard icon={MessageSquarePlus} label="Student contributions" value={overview?.contributionCount ?? 0} />
          <StatCard icon={Users} label="Active students" value={overview?.activeStudentCount ?? 0} />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Most missed words</CardTitle>
          </CardHeader>
          <CardContent>
            {wordStatsLoading ? <Skeleton className="h-40" /> : <MostMissedWordsChart stats={wordStats ?? []} />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Student progress</CardTitle>
          </CardHeader>
          <CardContent>
            {studentStatsLoading ? (
              <Skeleton className="h-40" />
            ) : (
              <StudentProgressTable stats={studentStats ?? []} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
