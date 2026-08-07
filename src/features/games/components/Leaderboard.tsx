import { Trophy } from "lucide-react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import type { GameParticipant } from "@/features/games/useGameSession"

const MEDALS = ["🥇", "🥈", "🥉"]

interface LeaderboardProps {
  participants: GameParticipant[]
  /** Roster of display names, keyed by class_student_id -- the
   * participants table itself doesn't carry names, only ids. */
  namesById: Record<string, string>
  highlightClassStudentId?: string
  showTeams?: boolean
}

/** Shared by the teacher host console and the student results screen --
 * participants arrive pre-sorted by score (useGameParticipantsQuery). */
export function Leaderboard({ participants, namesById, highlightClassStudentId, showTeams }: LeaderboardProps) {
  if (participants.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">No one has joined yet.</p>
  }

  return (
    <ol className="flex flex-col gap-1.5">
      {participants.map((p, i) => (
        <li
          key={p.id}
          className={cn(
            "flex items-center gap-3 rounded-lg border border-border px-3 py-2",
            p.class_student_id === highlightClassStudentId && "border-primary bg-primary/5",
          )}
        >
          <span className="w-6 shrink-0 text-center text-sm text-muted-foreground">
            {MEDALS[i] ?? i + 1}
          </span>
          <span className="flex-1 truncate font-medium">
            {namesById[p.class_student_id] ?? "Student"}
          </span>
          {showTeams && p.team && (
            <Badge variant="outline" className="shrink-0">
              {p.team}
            </Badge>
          )}
          <span className="flex shrink-0 items-center gap-1 tabular-nums font-semibold">
            <Trophy className="size-3.5 text-muted-foreground" />
            {p.score}
          </span>
        </li>
      ))}
    </ol>
  )
}
