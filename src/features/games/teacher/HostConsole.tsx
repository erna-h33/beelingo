import { useMemo } from "react"
import { toast } from "sonner"
import { PartyPopper, Users } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useStudentsQuery } from "@/features/classes/students/useStudents"
import { GAME_TYPE_LABEL } from "@/features/games/constants"
import { Leaderboard } from "@/features/games/components/Leaderboard"
import { useAnsweredCountQuery } from "@/features/games/useGameAnswers"
import {
  useAdvanceQuestionMutation,
  useEndGameSessionMutation,
  useStartGameSessionMutation,
} from "@/features/games/useGameActions"
import { useGameQuestionsQuery } from "@/features/games/useGameQuestions"
import { useGameParticipantsQuery, useGameSessionQuery } from "@/features/games/useGameSession"
import { useWaitingRoomPresence } from "@/features/games/useWaitingRoomPresence"

interface HostConsoleProps {
  classId: string
  sessionId: string
  /** Back to the setup form, e.g. to start a fresh game after this one completes. */
  onReset: () => void
}

export function HostConsole({ classId, sessionId, onReset }: HostConsoleProps) {
  const { data: session, isLoading: sessionLoading } = useGameSessionQuery(sessionId)
  const { data: participants } = useGameParticipantsQuery(sessionId)
  const { data: students } = useStudentsQuery(classId)
  const { data: questions } = useGameQuestionsQuery(sessionId, session?.current_question_index)
  const presenceRoster = useWaitingRoomPresence(session?.status === "waiting" ? sessionId : undefined)

  const startSession = useStartGameSessionMutation(sessionId)
  const advanceQuestion = useAdvanceQuestionMutation(sessionId)
  const endSession = useEndGameSessionMutation(sessionId)

  const namesById = useMemo(
    () => Object.fromEntries((students ?? []).map((s) => [s.id, s.display_name])),
    [students],
  )

  const totalQuestions = useMemo(
    () => (questions && questions.length > 0 ? Math.max(...questions.map((q) => q.sequence_index)) + 1 : 0),
    [questions],
  )
  const currentQuestion = questions?.find((q) => q.sequence_index === session?.current_question_index)
  const isLast = (session?.current_question_index ?? 0) >= totalQuestions - 1
  const { data: answeredCount } = useAnsweredCountQuery(currentQuestion?.id)

  const isFlashcards = session?.game_type === "flashcards"

  if (sessionLoading || !session) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40" />
      </div>
    )
  }

  async function handleStart() {
    try {
      await startSession.mutateAsync()
    } catch (error) {
      toast.error("Couldn't start game", { description: error instanceof Error ? error.message : undefined })
    }
  }

  async function handleNext() {
    try {
      await advanceQuestion.mutateAsync()
    } catch (error) {
      toast.error("Couldn't advance", { description: error instanceof Error ? error.message : undefined })
    }
  }

  async function handleEnd() {
    try {
      await endSession.mutateAsync()
    } catch (error) {
      toast.error("Couldn't end game", { description: error instanceof Error ? error.message : undefined })
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold">{GAME_TYPE_LABEL[session.game_type]}</h2>
          <p className="text-sm text-muted-foreground capitalize">{session.status}</p>
        </div>
        {session.status !== "completed" && (
          <Button variant="outline" size="sm" onClick={handleEnd} disabled={endSession.isPending}>
            End game
          </Button>
        )}
      </div>

      {session.status === "waiting" && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
            <Users className="size-4" />
            Students: open the Game tab on your device to join.
            {presenceRoster.length > 0 && (
              <span className="ml-auto text-xs">{presenceRoster.length} connected now</span>
            )}
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">{participants?.length ?? 0} joined</p>
            <Leaderboard participants={participants ?? []} namesById={namesById} />
          </div>
          <Button
            size="lg"
            onClick={handleStart}
            disabled={startSession.isPending || (participants?.length ?? 0) === 0}
          >
            {startSession.isPending ? "Starting…" : "Start game"}
          </Button>
        </div>
      )}

      {session.status === "active" && (
        <div className="flex flex-col gap-4">
          {isFlashcards ? (
            <p className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
              Self-paced review -- students are flipping through the deck on their own. End the game whenever
              you're ready to move on.
            </p>
          ) : (
            <>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">
                  Question {(session.current_question_index ?? 0) + 1} of {totalQuestions}
                </span>
                <span className="text-muted-foreground">
                  {answeredCount ?? 0} / {participants?.length ?? 0} answered
                </span>
              </div>
              <Button size="lg" onClick={handleNext} disabled={advanceQuestion.isPending || isLast}>
                {isLast ? "Last question" : advanceQuestion.isPending ? "Advancing…" : "Next question"}
              </Button>
            </>
          )}
          {!isFlashcards && (
            <div>
              <p className="mb-2 text-sm font-medium">Leaderboard</p>
              <Leaderboard
                participants={participants ?? []}
                namesById={namesById}
                showTeams={session.game_type === "team_battle"}
              />
            </div>
          )}
        </div>
      )}

      {session.status === "completed" && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-8 text-center">
            <PartyPopper className="size-8 text-muted-foreground" />
            <p className="font-medium">Game over!</p>
          </div>
          <Leaderboard
            participants={participants ?? []}
            namesById={namesById}
            showTeams={session.game_type === "team_battle"}
          />
          <Button size="lg" onClick={onReset}>
            Start a new game
          </Button>
        </div>
      )}
    </div>
  )
}
