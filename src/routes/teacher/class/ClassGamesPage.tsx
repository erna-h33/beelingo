import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"

import { Skeleton } from "@/components/ui/skeleton"
import { GameSetupForm } from "@/features/games/teacher/GameSetupForm"
import { HostConsole } from "@/features/games/teacher/HostConsole"
import { useActiveGameSessionForClassQuery } from "@/features/games/useGameSession"

export default function ClassGamesPage() {
  const { classId } = useParams<{ classId: string }>()
  const { data: resumableSession, isLoading } = useActiveGameSessionForClassQuery(classId)
  const [sessionId, setSessionId] = useState<string | null>(null)

  // On first load, resume whatever waiting/active session already exists
  // for this class (e.g. the teacher refreshed the page mid-game).
  useEffect(() => {
    if (resumableSession && resumableSession.id !== sessionId) setSessionId(resumableSession.id)
  }, [resumableSession, sessionId])

  if (!classId) return null

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40" />
      </div>
    )
  }

  if (sessionId) {
    return <HostConsole classId={classId} sessionId={sessionId} onReset={() => setSessionId(null)} />
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-semibold">Start a game</h2>
        <p className="text-sm text-muted-foreground">
          Pick a game type and a word source, then start it -- students join from their Game tab.
        </p>
      </div>
      <GameSetupForm classId={classId} onCreated={setSessionId} />
    </div>
  )
}
