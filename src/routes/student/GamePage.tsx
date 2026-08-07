import { Skeleton } from "@/components/ui/skeleton"
import { useStudentSessionQuery } from "@/features/studentSession/useStudentSession"
import { PlayerShell } from "@/features/games/student/PlayerShell"

export default function GamePage() {
  const { data: session, isLoading } = useStudentSessionQuery()

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-56" />
      </div>
    )
  }

  if (!session) return null

  return <PlayerShell classId={session.classId} classStudentId={session.classStudentId} />
}
