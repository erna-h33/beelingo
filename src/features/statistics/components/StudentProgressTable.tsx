import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { ClassStudentStat } from "@/lib/supabase/types"

interface StudentProgressTableProps {
  stats: ClassStudentStat[]
}

export function StudentProgressTable({ stats }: StudentProgressTableProps) {
  if (stats.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No active students yet.</p>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Student</TableHead>
          <TableHead className="text-right">Games played</TableHead>
          <TableHead className="text-right">Accuracy</TableHead>
          <TableHead className="text-right">Total score</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {stats.map((s) => {
          const totalAnswers = s.correctCount + s.incorrectCount
          const accuracy = totalAnswers > 0 ? Math.round((s.correctCount / totalAnswers) * 100) : null
          return (
            <TableRow key={s.classStudentId}>
              <TableCell className="font-medium">{s.displayName}</TableCell>
              <TableCell className="text-right tabular-nums">{s.gamesPlayed}</TableCell>
              <TableCell className="text-right tabular-nums">
                {accuracy === null ? (
                  <span className="text-muted-foreground">—</span>
                ) : (
                  <span className="inline-flex items-center gap-2">
                    <span className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                      <span
                        className="block h-full rounded-full bg-primary"
                        style={{ width: `${accuracy}%` }}
                      />
                    </span>
                    {accuracy}%
                  </span>
                )}
              </TableCell>
              <TableCell className="text-right tabular-nums">{s.totalScore}</TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
