import { useEffect, useMemo, useState } from "react"
import { PartyPopper, Users } from "lucide-react"

import { Skeleton } from "@/components/ui/skeleton"
import { useStudentsQuery } from "@/features/classes/students/useStudents"
import { GAME_TYPE_LABEL } from "@/features/games/constants"
import { Leaderboard } from "@/features/games/components/Leaderboard"
import { useJoinGameSessionMutation } from "@/features/games/useGameActions"
import { useGameQuestionsQuery, type QuestionPayload } from "@/features/games/useGameQuestions"
import {
  useActiveGameSessionForClassQuery,
  useGameParticipantsQuery,
  useGameSessionQuery,
} from "@/features/games/useGameSession"

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
  const { data: questions } = useGameQuestionsQuery(sessionId ?? undefined, session?.current_question_index)

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
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-8 text-center">
          <PartyPopper className="size-8 text-muted-foreground" />
          <p className="font-medium">{isFlashcards ? "Nice work!" : "Game over!"}</p>
          {!isFlashcards && own && <p className="text-sm text-muted-foreground">You scored {own.score} points</p>}
        </div>
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

  const currentQuestion = questions?.find((q) => q.sequence_index === session.current_question_index)
  if (!currentQuestion) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-56" />
      </div>
    )
  }

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
          promptLabel="Translate this word"
          prompt={payload.prompt}
          placeholder="Type the translation"
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
        />
      )
    default:
      return null
  }
}
