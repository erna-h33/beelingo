import { useEffect, useMemo, useState } from "react"
import { PartyPopper, Users } from "lucide-react"

import { Skeleton } from "@/components/ui/skeleton"
import { useStudentsQuery } from "@/features/classes/students/useStudents"
import { GAME_TYPE_LABEL, isSelfPacedGameType } from "@/features/games/constants"
import { BeeHiveRecallResults } from "@/features/games/components/BeeHiveRecallResults"
import { Leaderboard } from "@/features/games/components/Leaderboard"
import { useJoinGameSessionMutation } from "@/features/games/useGameActions"
import { useGameAnswersForQuestionQuery } from "@/features/games/useGameAnswers"
import { useGameQuestionsQuery, type QuestionPayload } from "@/features/games/useGameQuestions"
import {
  useActiveGameSessionForClassQuery,
  useGameParticipantsQuery,
  useGameSessionQuery,
} from "@/features/games/useGameSession"

import { BeeHiveRecallPlayer } from "./BeeHiveRecallPlayer"
import { FlashcardsPlayer } from "./FlashcardsPlayer"
import { MultipleChoicePlayer } from "./MultipleChoicePlayer"
import { PairsPlayer } from "./PairsPlayer"
import { TypingPlayer } from "./TypingPlayer"

interface PlayerShellProps {
  classId: string
  classStudentId: string
}

/**
 * Top-level orchestrator for the student game screen: finds/joins the
 * active session for the class, then renders the waiting room, the
 * right per-question-type player, or the final results -- all driven by
 * useGameSessionQuery's Postgres Changes subscription, so nothing here
 * polls.
 */
export function PlayerShell({ classId, classStudentId }: PlayerShellProps) {
  const { data: resumableSession } = useActiveGameSessionForClassQuery(classId)
  const [sessionId, setSessionId] = useState<string | null>(null)

  useEffect(() => {
    if (resumableSession && resumableSession.id !== sessionId) setSessionId(resumableSession.id)
  }, [resumableSession, sessionId])

  const { data: session } = useGameSessionQuery(sessionId ?? undefined)
  const { data: participants } = useGameParticipantsQuery(sessionId ?? undefined)
  const { data: students } = useStudentsQuery(classId)
  const {
    data: questions,
    refetch: refetchQuestions,
  } = useGameQuestionsQuery(sessionId ?? undefined, session?.current_question_index)

  const joinSession = useJoinGameSessionMutation()
  const [participantId, setParticipantId] = useState<string | null>(null)

  useEffect(() => {
    if (!sessionId) return
    setParticipantId(null)
    joinSession.mutateAsync({ sessionId, classStudentId }).then((row) => setParticipantId(row.id))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per session, mutateAsync identity is unstable
  }, [sessionId, classStudentId])

  const namesById = useMemo(
    () => Object.fromEntries((students ?? []).map((s) => [s.id, s.display_name])),
    [students],
  )

  if (!sessionId) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
        <Users className="size-8 text-muted-foreground" />
        <div>
          <p className="font-medium">Waiting for your teacher…</p>
          <p className="text-sm text-muted-foreground">A game will appear here the moment one starts.</p>
        </div>
      </div>
    )
  }

  if (!session || !participantId) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-56" />
      </div>
    )
  }

  if (session.status === "waiting") {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
        <Users className="size-8 text-muted-foreground" />
        <div>
          <p className="font-medium">You're in!</p>
          <p className="text-sm text-muted-foreground">
            {GAME_TYPE_LABEL[session.game_type]} -- waiting for your teacher to start.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">{participants?.length ?? 0} players joined</p>
      </div>
    )
  }

  if (session.status === "completed") {
    const own = participants?.find((p) => p.class_student_id === classStudentId)
    const isFlashcards = session.game_type === "flashcards"
    const isRecall = session.game_type === "beehive_recall"
    const recallQuestion = questions?.[0]
    const recallPayload = isRecall
      ? (recallQuestion?.question_payload as unknown as Extract<QuestionPayload, { type: "beehive_recall" }>)
      : undefined

    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-8 text-center">
          <PartyPopper className="size-8 text-muted-foreground" />
          <p className="font-medium">{isFlashcards ? "Nice work!" : "Game over!"}</p>
          {!isFlashcards && own && <p className="text-sm text-muted-foreground">You scored {own.score} points</p>}
        </div>
        {isRecall && recallQuestion && recallPayload && (
          <RecallResultsForStudent
            gameQuestionId={recallQuestion.id}
            pairs={recallPayload.pairs}
            ownParticipantId={participantId}
          />
        )}
        {!isFlashcards && (
          <Leaderboard
            participants={participants ?? []}
            namesById={namesById}
            highlightClassStudentId={classStudentId}
            showTeams={session.game_type === "team_battle"}
          />
        )}
      </div>
    )
  }

  // status === "active"
  if (session.game_type === "flashcards") {
    return <FlashcardsPlayer sessionId={sessionId} currentQuestionIndex={session.current_question_index} />
  }

  const selfPaced = isSelfPacedGameType(session.game_type)
  const own = participants?.find((p) => p.class_student_id === classStudentId)
  const totalQuestions = session.settings?.totalQuestions
  const ownAnsweredCount = own ? own.correct_count + own.incorrect_count : 0

  // Self-paced: once this student has answered every question the
  // session actually created, there's nothing left for them to see
  // (game_questions only ever holds totalQuestions rows), regardless
  // of whether the session itself, or any other student, is done yet.
  // ownAnsweredCount comes straight from game_session_participants (set
  // by game_submit_answer), so this survives a page reload correctly --
  // unlike deriving it from local component state.
  if (selfPaced && totalQuestions !== undefined && ownAnsweredCount >= totalQuestions) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-12 text-center">
          <PartyPopper className="size-8 text-muted-foreground" />
          <div>
            <p className="font-medium">You've finished!</p>
            <p className="text-sm text-muted-foreground">
              {own && `You scored ${own.score} points. `}Waiting for everyone else to catch up…
            </p>
          </div>
        </div>
        <Leaderboard
          participants={participants ?? []}
          namesById={namesById}
          highlightClassStudentId={classStudentId}
          showTeams={session.game_type === "team_battle"}
        />
      </div>
    )
  }

  // Self-paced games reveal questions strictly in order via RLS
  // (migration 0031): the array's length always equals however many
  // this student has answered plus the one newly-revealed unanswered
  // question, so the last entry is always the current one -- no local
  // "answered so far" tracking needed, and it's correct on a fresh
  // page load too. Host-paced games still key off the shared
  // current_question_index.
  const currentQuestion = selfPaced
    ? questions?.[questions.length - 1]
    : questions?.find((q) => q.sequence_index === session.current_question_index)
  if (!currentQuestion) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-56" />
      </div>
    )
  }

  // Self-paced only: after a correct/incorrect result is shown, pull
  // the next question in immediately rather than waiting on the
  // teacher. The query key doesn't change (current_question_index
  // stays put for these game types), so a manual refetch is what
  // actually picks up the row RLS just revealed.
  const handleAnswered = selfPaced ? () => void refetchQuestions() : undefined

  const payload = currentQuestion.question_payload as unknown as QuestionPayload

  switch (payload.type) {
    case "matching":
    case "memory_challenge":
      return (
        <PairsPlayer
          gameQuestionId={currentQuestion.id}
          participantId={participantId}
          pairs={payload.pairs}
          mode={payload.type}
        />
      )
    case "typing_challenge":
      return (
        <TypingPlayer
          gameQuestionId={currentQuestion.id}
          participantId={participantId}
          promptLabel="Type the word for this"
          prompt={payload.prompt}
          placeholder="Type the word"
          onAnswered={handleAnswered}
        />
      )
    case "fill_in_blank":
      return (
        <TypingPlayer
          gameQuestionId={currentQuestion.id}
          participantId={participantId}
          promptLabel="Fill in the blank"
          prompt={payload.sentence}
          placeholder="Type the missing word"
          onAnswered={handleAnswered}
        />
      )
    case "reverse_translation":
      return (
        <MultipleChoicePlayer
          gameQuestionId={currentQuestion.id}
          participantId={participantId}
          promptLabel="Which word means this?"
          prompt={payload.prompt}
          choices={payload.choices}
          onAnswered={handleAnswered}
        />
      )
    case "speed_translation":
    case "team_battle":
      return (
        <MultipleChoicePlayer
          gameQuestionId={currentQuestion.id}
          participantId={participantId}
          promptLabel="Translate this word"
          prompt={payload.prompt}
          choices={payload.choices}
          onAnswered={handleAnswered}
        />
      )
    case "beehive_recall":
      return <BeeHiveRecallPlayer gameQuestionId={currentQuestion.id} participantId={participantId} payload={payload} />
    default:
      return null
  }
}

/** Owns the game_answers fetch so it's only made when actually needed
 * (the completed-state BeeHive Recall results block), without
 * conditionally calling a hook inside PlayerShell itself. */
function RecallResultsForStudent({
  gameQuestionId,
  pairs,
  ownParticipantId,
}: {
  gameQuestionId: string
  pairs: { wordId: string; word: string }[]
  ownParticipantId: string
}) {
  const { data: answers } = useGameAnswersForQuestionQuery(gameQuestionId)
  return <BeeHiveRecallResults pairs={pairs} answers={answers ?? []} ownParticipantId={ownParticipantId} />
}
