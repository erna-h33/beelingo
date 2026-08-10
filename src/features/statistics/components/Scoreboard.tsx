import { useMemo } from "react"
import { Star } from "lucide-react"

import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import type { ClassStudentStat } from "@/lib/supabase/types"

/** Rank-specific styling for the top-3 podium -- gold reuses the same
 * primary-tint treatment already used for highlighted/active elements
 * elsewhere on the dashboard (e.g. the active-game banner card),
 * silver/bronze step down through the existing secondary/accent tokens
 * rather than introducing new one-off colors. Pedestal height shrinks
 * 1st -> 3rd, the classic podium "steps" cue. */
const PODIUM = [
  { avatar: "bg-primary/15 text-primary", step: "h-16 bg-primary text-primary-foreground" },
  { avatar: "bg-secondary text-secondary-foreground", step: "h-11 bg-secondary text-secondary-foreground" },
  { avatar: "bg-accent text-accent-foreground", step: "h-8 bg-accent text-accent-foreground" },
]

interface ScoreboardProps {
  students: ClassStudentStat[]
  highlightClassStudentId?: string
}

/**
 * A persistent, cross-game ranking -- fed by class_student_stats'
 * cumulative totalScore across every completed game in the class, not
 * one session's live participants (see Leaderboard for that). Shown on
 * the teacher's per-class Statistics tab and the student's own
 * dashboard: top 3 as an actual podium (rank number on a stepped block,
 * tallest/gold in the middle), everyone else below as a plain ranked
 * list.
 */
export function Scoreboard({ students, highlightClassStudentId }: ScoreboardProps) {
  const ranked = useMemo(() => [...students].sort((a, b) => b.totalScore - a.totalScore), [students])

  if (ranked.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">No active students yet.</p>
  }

  const top3 = ranked.slice(0, 3)
  const rest = ranked.slice(3)
  // Only reorder into the classic 2nd-1st-3rd arrangement when there
  // are exactly three -- with fewer, the step height alone already
  // conveys rank, so plain rank order reads better than forcing a gap.
  const podiumOrder = top3.length === 3 ? ["order-2", "order-1", "order-3"] : top3.map(() => "")

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-end justify-center gap-3">
        {top3.map((s, i) => {
          const isFirst = i === 0
          const isHighlighted = s.classStudentId === highlightClassStudentId
          const style = PODIUM[i]
          return (
            <div
              key={s.classStudentId}
              className={cn("flex w-20 flex-col items-center gap-1.5", podiumOrder[i])}
            >
              <Avatar
                size={isFirst ? "lg" : "default"}
                className={cn(isHighlighted && "ring-2 ring-primary ring-offset-2 ring-offset-background")}
              >
                <AvatarFallback className={style.avatar}>
                  {s.displayName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="w-full truncate text-center text-sm font-medium">{s.displayName}</span>
              <span className="flex items-center gap-1 text-xs font-semibold tabular-nums text-muted-foreground">
                <Star className="size-3 fill-primary text-primary" />
                {s.totalScore}
              </span>
              <div
                className={cn(
                  "flex w-full items-center justify-center rounded-t-md font-display text-2xl font-bold",
                  style.step,
                )}
              >
                {i + 1}
              </div>
            </div>
          )
        })}
      </div>

      {rest.length > 0 && (
        <ol className="flex flex-col gap-1.5">
          {rest.map((s, i) => (
            <li
              key={s.classStudentId}
              className={cn(
                "flex items-center gap-3 rounded-lg border border-border px-3 py-2",
                s.classStudentId === highlightClassStudentId && "border-primary bg-primary/5",
              )}
            >
              <span className="w-6 shrink-0 text-center text-sm text-muted-foreground">{i + 4}</span>
              <span className="flex-1 truncate font-medium">{s.displayName}</span>
              <span className="flex shrink-0 items-center gap-1 tabular-nums font-semibold">
                <Star className="size-3.5 fill-primary text-primary" />
                {s.totalScore}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
