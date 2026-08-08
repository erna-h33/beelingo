import { useMemo } from "react"
import { Trophy } from "lucide-react"

import { cn } from "@/lib/utils"
import type { ClassStudentStat } from "@/lib/supabase/types"

const MEDALS = ["🥇", "🥈", "🥉"]

interface ScoreboardProps {
  students: ClassStudentStat[]
  highlightClassStudentId?: string
}

/**
 * A persistent, cross-game ranking -- same visual language as the
 * in-game Leaderboard (medals, rounded rows, trophy + score), but fed
 * by class_student_stats' cumulative totalScore across every completed
 * game in the class, not one session's live participants. Shown on the
 * teacher's per-class Statistics tab and the student's own dashboard.
 */
export function Scoreboard({ students, highlightClassStudentId }: ScoreboardProps) {
  const ranked = useMemo(() => [...students].sort((a, b) => b.totalScore - a.totalScore), [students])

  if (ranked.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">No active students yet.</p>
  }

  return (
    <ol className="flex flex-col gap-1.5">
      {ranked.map((s, i) => (
        <li
          key={s.classStudentId}
          className={cn(
            "flex items-center gap-3 rounded-lg border border-border px-3 py-2",
            s.classStudentId === highlightClassStudentId && "border-primary bg-primary/5",
          )}
        >
          <span className="w-6 shrink-0 text-center text-sm text-muted-foreground">{MEDALS[i] ?? i + 1}</span>
          <span className="flex-1 truncate font-medium">{s.displayName}</span>
          <span className="flex shrink-0 items-center gap-1 tabular-nums font-semibold">
            <Trophy className="size-3.5 text-muted-foreground" />
            {s.totalScore}
          </span>
        </li>
      ))}
    </ol>
  )
}
