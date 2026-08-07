import { Link } from "react-router-dom"
import {
  ArrowRight,
  Gamepad2,
  Hexagon,
  MessageSquarePlus,
  Percent,
  Plus,
  Sparkles,
  Users,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/features/auth/useAuth"
import { useClassesQuery } from "@/features/classes/useClasses"
import { ClassCard } from "@/features/classes/components/ClassCard"
import { MostMissedWordsChart } from "@/features/statistics/components/MostMissedWordsChart"
import { StatCard } from "@/features/statistics/components/StatCard"
import { useTeacherDashboardStatsQuery } from "@/features/statistics/useDashboardStats"

export default function DashboardPage() {
  const { session } = useAuth()
  const { data: classes, isLoading: classesLoading } = useClassesQuery()
  const { data: stats, isLoading: statsLoading } = useTeacherDashboardStatsQuery()

  const teacherName = session?.user.user_metadata?.display_name || session?.user.email
  const hasClasses = !classesLoading && (classes?.length ?? 0) > 0

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back{teacherName ? `, ${teacherName}` : ""}</h1>
        <p className="text-sm text-muted-foreground">Here's how your classes are doing.</p>
      </div>

      {!classesLoading && !hasClasses && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <Sparkles className="size-8 text-muted-foreground" />
            <div>
              <p className="font-medium">Create your first class to get started</p>
              <p className="text-sm text-muted-foreground">
                Each class gets its own Hive, roster, and live games.
              </p>
            </div>
            <Button asChild>
              <Link to="/t/classes">
                <Plus className="size-4" />
                Create a class
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {hasClasses && (
        <>
          {statsLoading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-[68px]" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <StatCard icon={Sparkles} label="Classes" value={stats?.totalClasses ?? 0} />
              <StatCard icon={Hexagon} label="Hive words" value={stats?.totalHiveWords ?? 0} />
              <StatCard icon={Users} label="Active students" value={stats?.totalActiveStudents ?? 0} />
              <StatCard icon={Gamepad2} label="Games played" value={stats?.totalGamesPlayed ?? 0} />
              <StatCard
                icon={Percent}
                label="Average accuracy"
                value={stats?.averageAccuracy !== null && stats?.averageAccuracy !== undefined ? `${stats.averageAccuracy}%` : "—"}
              />
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Most missed words</CardTitle>
              </CardHeader>
              <CardContent>
                {statsLoading ? (
                  <Skeleton className="h-40" />
                ) : (
                  <MostMissedWordsChart stats={stats?.mostMissedWords ?? []} />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  <MessageSquarePlus className="mr-1.5 inline size-4 text-muted-foreground" />
                  Top contributors
                </CardTitle>
              </CardHeader>
              <CardContent>
                {statsLoading ? (
                  <Skeleton className="h-40" />
                ) : (stats?.topContributors.length ?? 0) === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No student contributions yet.
                  </p>
                ) : (
                  <ol className="flex flex-col gap-1.5">
                    {stats!.topContributors.map((c, i) => (
                      <li
                        key={c.classStudentId}
                        className="flex items-center gap-3 rounded-lg border border-border px-3 py-2"
                      >
                        <span className="w-5 shrink-0 text-center text-sm text-muted-foreground">{i + 1}</span>
                        <div className="flex-1">
                          <p className="text-sm font-medium">{c.displayName}</p>
                          <p className="text-xs text-muted-foreground">{c.className}</p>
                        </div>
                        <span className="shrink-0 text-sm font-semibold tabular-nums">{c.contributionCount}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Your classes</h2>
              {(classes?.length ?? 0) > 6 && (
                <Button asChild variant="ghost" size="sm">
                  <Link to="/t/classes">
                    View all
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {classes?.slice(0, 6).map((classItem) => (
                <ClassCard key={classItem.id} classItem={classItem} />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
