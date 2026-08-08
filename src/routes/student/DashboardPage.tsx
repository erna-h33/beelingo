import { Link } from "react-router-dom"
import { CheckCircle2, Flame, Gamepad2, MessageSquarePlus, Percent } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { GAME_TYPE_LABEL } from "@/features/games/constants"
import { useActiveGameSessionForClassQuery } from "@/features/games/useGameSession"
import { StatCard } from "@/features/statistics/components/StatCard"
import { useStudentDashboardStatsQuery } from "@/features/statistics/useDashboardStats"
import { useStudentSessionQuery } from "@/features/studentSession/useStudentSession"

export default function DashboardPage() {
  const { data: session, isLoading: sessionLoading } = useStudentSessionQuery()
  const { data: stats, isLoading: statsLoading } = useStudentDashboardStatsQuery(Boolean(session))
  const { data: activeSession } = useActiveGameSessionForClassQuery(session?.classId)

  if (sessionLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-24" />
      </div>
    )
  }

  if (!session) return null

  const totalAnswers = (stats?.correctCount ?? 0) + (stats?.incorrectCount ?? 0)
  const accuracy = totalAnswers > 0 ? Math.round(((stats?.correctCount ?? 0) / totalAnswers) * 100) : null

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Hi, {session.displayName}</h1>
        <p className="text-sm text-muted-foreground">{session.className}</p>
      </div>

      {activeSession && (
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="flex items-center justify-between gap-3 py-4">
            <div className="flex items-center gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <Gamepad2 className="size-4.5" />
              </div>
              <div>
                <p className="font-medium">{GAME_TYPE_LABEL[activeSession.game_type]} is starting!</p>
                <p className="text-xs text-muted-foreground">
                  {activeSession.status === "waiting" ? "Waiting for your teacher to start" : "In progress"}
                </p>
              </div>
            </div>
            <Button asChild>
              <Link to="/s/game">Jump in</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {statsLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[68px]" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard icon={Flame} label="Day streak" value={stats?.streakDays ?? 0} />
          <StatCard icon={Percent} label="Accuracy" value={accuracy === null ? "—" : `${accuracy}%`} />
          <StatCard icon={CheckCircle2} label="Words learned" value={stats?.wordsLearned ?? 0} />
          <StatCard icon={MessageSquarePlus} label="Contributions" value={stats?.contributionsCount ?? 0} />
        </div>
      )}

      {!activeSession && (
        <Button asChild variant="outline" size="lg" className="w-full">
          <Link to="/s/hive">
            <MessageSquarePlus className="size-4" />
            Add a word to the Hive
          </Link>
        </Button>
      )}
    </div>
  )
}
