import { useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useGameQuestionsQuery, type QuestionPayload } from "@/features/games/useGameQuestions"

interface FlashcardsPlayerProps {
  sessionId: string
  currentQuestionIndex: number
}

/** Self-paced review, no scoring (game_create_session never inserts a
 * game_question_answers row for flashcards) -- every card is revealed
 * at creation time, so this fetches the whole deck once and lets the
 * student flip through it at their own pace, independent of the host. */
export function FlashcardsPlayer({ sessionId, currentQuestionIndex }: FlashcardsPlayerProps) {
  const { data: questions, isLoading } = useGameQuestionsQuery(sessionId, currentQuestionIndex)
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)

  if (isLoading || !questions) {
    return <Skeleton className="h-64" />
  }

  const card = questions[index]
  const payload = card?.question_payload as unknown as Extract<QuestionPayload, { type: "flashcards" }> | undefined

  if (!card || !payload) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No cards in this deck.</p>
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="text-center text-sm text-muted-foreground">
        Card {index + 1} of {questions.length}
      </p>

      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        className="flex min-h-56 flex-col items-center justify-center gap-2 rounded-xl border border-border bg-card px-6 py-10 text-center transition-colors hover:border-primary/50"
      >
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          {flipped ? "Translation" : "Word"} · tap to flip
        </span>
        <span className="text-3xl font-semibold">{flipped ? payload.translation ?? "—" : payload.word}</span>
      </button>

      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="icon"
          disabled={index === 0}
          onClick={() => {
            setIndex((i) => Math.max(0, i - 1))
            setFlipped(false)
          }}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          disabled={index === questions.length - 1}
          onClick={() => {
            setIndex((i) => Math.min(questions.length - 1, i + 1))
            setFlipped(false)
          }}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  )
}
