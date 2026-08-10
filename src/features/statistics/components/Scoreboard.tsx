import { useMemo } from "react"
import { Trophy } from "lucide-react"

import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import type { ClassStudentStat } from "@/lib/supabase/types"

const MEDALS = ["🥇", "🥈", "🥉"]

/** Rank-specific styling for the top-3 podium avatars -- gold gets the
 * same primary-tint treatment already used for highlighted/active
 * elements elsewhere on the dashboard (e.g. the active-game banner
 * card), silver/bronze step down through the existing secondary/accent
 * tokens rather than introducing new one-off colors. */
const PODIUM_STYLE = [
  { avatar: "bg-primary/15 text-primary ring-2 ring-primary/30", card: "border-primary/40 bg-primary/5" },
  { avatar: "bg-secondary text-secondary-foreground", card: "border-border" },
  { avatar: "bg-accent text-accent-foreground", card: "border-border" },
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
 * dashboard: top 3 as a podium (gold elevated + larger, in the middle),
 * everyone else below as a plain ranked list.
 */
export function Scoreboard({ students, highlightClassStudentId }: ScoreboardProps) {
  const ranked = useMemo(() => [...students].sort((a, b) => b.totalScore - a.totalScore), [students])

  if (ranked.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">No active students yet.</p>
  }

  const top3 = ranked.slice(0, 3)
  const rest = ranked.slice(3)
  // Only reorder into the classic 2nd-1st-3rd podium layout when there
  // are exactly three -- with fewer, plain rank order reads better than
  // a lopsided "gap" where 2nd or 3rd would otherwise be.
  const podiumOrder = top3.length === 3 ? ["order-2", "order-1", "order-3"] : top3.map(() => "")

  return (
    <div className="flex flex-col gap-4">
      <div className={cn("gap-2", top3.length === 3 ? "grid grid-cols-3" : "flex justify-center")}>
        {top3.map((s, i) => {
          const isFirst = i === 0
          const isHighlighted = s.classStudentId === highlightClassStudentId
          const style = PODIUM_STYLE[i]
          return (
            <div
              key={s.classStudentId}
              className={cn(
                "flex w-full max-w-28 flex-col items-center gap-1.5 rounded-lg border px-2 py-3 text-center",
                style.card,
                isFirst && "-mt-2.5 pb-4",
                isHighlighted && "ring-2 ring-primary",
                podiumOrder[i],
              )}
            >
              <span className="text-lg leading-none">{MEDALS[i]}</span>
              <Avatar size={isFirst ? "lg" : "default"}>
                <AvatarFallback className={style.avatar}>
                  {s.displayName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="w-full truncate text-sm font-medium">{s.displayName}</span>
              <span className="flex items-center gap-1 text-xs font-semibold tabular-nums text-muted-foreground">
                <Trophy className="size-3" />
                {s.totalScore}
              </span>
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
                <Trophy className="size-3.5 text-muted-foreground" />
                {s.totalScore}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
