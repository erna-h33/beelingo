import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { PartyPopper, Users } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useStudentsQuery } from "@/features/classes/students/useStudents"
import { GAME_TYPE_LABEL, isSelfPacedGameType } from "@/features/games/constants"
import { BeeHiveRecallResults } from "@/features/games/components/BeeHiveRecallResults"
import { Leaderboard } from "@/features/games/components/Leaderboard"
import { useAnsweredCountQuery, useGameAnswersForQuestionQuery } from "@/features/games/useGameAnswers"
import {
  useAdvanceQuestionMutation,
  useEndGameSessionMutation,
  useStartGameSessionMutation,
} from "@/features/games/useGameActions"
import { useGameQuestionsQuery, type QuestionPayload } from "@/features/games/useGameQuestions"
import { type GameParticipant, useGameParticipantsQuery, useGameSessionQuery } from "@/features/games/useGameSession"
import { useWaitingRoomPresence } from "@/features/games/useWaitingRoomPresence"

// How long after every student finishes a self-paced game before it
// auto-ends -- the End Game button also flashes for this entire window,
// so a teacher glancing back at the screen can't miss it.
const AUTO_END_MS = 10_000

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

  const selfPaced = session ? isSelfPacedGameType(session.game_type) : false

  // Every participant has answered every question that exists for this
  // session -- checked directly against correct_count + incorrect_count
  // (server-truth, set by game_submit_answer), not any client-guessed
  // signal.
  const allSelfPacedFinished =
    selfPaced &&
    totalQuestions > 0 &&
    (participants?.length ?? 0) > 0 &&
    (participants ?? []).every((p) => p.correct_count + p.incorrect_count >= totalQuestions)

  // Tracks when the class first became "all finished," so the End Game
  // button can flash for the whole AUTO_END_MS window and the game can
  // auto-end once it elapses if the teacher hasn't ended it manually.
  // Resets whenever the session leaves "active" (fresh game, or already
  // ended).
  const [allFinishedSince, setAllFinishedSince] = useState<number | null>(null)
  useEffect(() => {
    if (session?.status !== "active" || !allSelfPacedFinished) {
      setAllFinishedSince(null)
      return
    }
    setAllFinishedSince((prev) => prev ?? Date.now())
  }, [allSelfPacedFinished, session?.status])

  // A ref rather than an effect dependency, so the mutation object's
  // identity changing on every render doesn't reset/restart the pending
  // auto-end timeout below.
  const endSessionRef = useRef(endSession.mutateAsync)
  endSessionRef.current = endSession.mutateAsync

  useEffect(() => {
    if (!allFinishedSince) return
    const remaining = AUTO_END_MS - (Date.now() - allFinishedSince)
    if (remaining <= 0) {
      void endSessionRef.current()
      return
    }
    const timeout = setTimeout(() => void endSessionRef.current(), remaining)
    return () => clearTimeout(timeout)
  }, [allFinishedSince])

  // Purely a 1s display ticker for the flash/countdown UI below -- the
  // actual auto-end timeout above doesn't depend on it.
  const [nowTick, setNowTick] = useState(() => Date.now())
  useEffect(() => {
    if (!allFinishedSince) return
    const id = setInterval(() => setNowTick(Date.now()), 1000)
    return () => clearInterval(id)
  }, [allFinishedSince])

  const elapsedSinceFinished = allFinishedSince ? nowTick - allFinishedSince : 0
  const isEndGameFlashing = allFinishedSince !== null && elapsedSinceFinished < AUTO_END_MS
  const autoEndCountdown =
    allFinishedSince !== null ? Math.max(0, Math.ceil((AUTO_END_MS - elapsedSinceFinished) / 1000)) : null

  const currentQuestion = questions?.find((q) => q.sequence_index === session?.current_question_index)
  const isLast = (session?.current_question_index ?? 0) >= totalQuestions - 1
  const { data: answeredCount } = useAnsweredCountQuery(currentQuestion?.id)

  const isFlashcards = session?.game_type === "flashcards"
  const isRecall = session?.game_type === "beehive_recall"
  const { data: recallAnswers } = useGameAnswersForQuestionQuery(isRecall ? currentQuestion?.id : undefined)
  const recallPayload = isRecall
    ? (currentQuestion?.question_payload as unknown as Extract<QuestionPayload, { type: "beehive_recall" }> | undefined)
    : undefined

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
          <div className="flex items-center gap-2">
            {autoEndCountdown !== null && (
              <span className="text-xs text-muted-foreground">
                Everyone's done -- auto-ending in {autoEndCountdown}s
              </span>
            )}
            <Button
              variant={isEndGameFlashing ? "destructive" : "outline"}
              size="sm"
              onClick={handleEnd}
              disabled={endSession.isPending}
              className={cn(isEndGameFlashing && "animate-pulse")}
            >
              End game
            </Button>
          </div>
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
          ) : selfPaced ? (
            <SelfPacedProgress participants={participants ?? []} namesById={namesById} totalQuestions={totalQuestions} />
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
          {isRecall && recallPayload && (
            <BeeHiveRecallResults pairs={recallPayload.pairs} answers={recallAnswers ?? []} />
          )}
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

/** Live per-student progress for self-paced game types, replacing the
 * shared "Question X of Y" / Next question UI -- there's no single
 * current question to advance since each student reveals their own via
 * RLS (migration 0031) the moment they answer. Derived entirely from
 * game_session_participants' correct_count/incorrect_count, already
 * fetched and kept live by useGameParticipantsQuery -- no extra query. */
function SelfPacedProgress({
  participants,
  namesById,
  totalQuestions,
}: {
  participants: GameParticipant[]
  namesById: Record<string, string>
  totalQuestions: number
}) {
  const finishedCount = participants.filter((p) => p.correct_count + p.incorrect_count >= totalQuestions).length

  return (
    <div className="flex flex-col gap-2 rounded-lg border px-4 py-3">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">Live progress</span>
        <span className="text-muted-foreground">
          {finishedCount} / {participants.length} finished
        </span>
      </div>
      <ul className="flex flex-col gap-1.5">
        {participants.map((p) => {
          const answered = Math.min(p.correct_count + p.incorrect_count, totalQuestions)
          const done = answered >= totalQuestions
          return (
            <li key={p.id} className="flex items-center justify-between text-sm">
              <span className={cn(done && "text-muted-foreground")}>
                {namesById[p.class_student_id] ?? "Student"}
                {done && " ✓"}
              </span>
              <span className="text-muted-foreground">
                {answered} / {totalQuestions}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
