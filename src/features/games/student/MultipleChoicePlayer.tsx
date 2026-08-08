import { useEffect, useState } from "react"
import { Check, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { useSubmitAnswerMutation } from "@/features/games/useGameActions"

interface MultipleChoicePlayerProps {
  gameQuestionId: string
  participantId: string
  prompt: string
  promptLabel: string
  choices: string[]
  /** Self-paced games only: called ~900ms after a correct/incorrect
   * result is shown, once per question, so the student sees feedback
   * flash before the next question replaces this one. Omitted for any
   * future host-paced game type, which wouldn't want this. */
  onAnswered?: () => void
}

/** Shared by speed_translation, reverse_translation, and team_battle --
 * all three reduce to "see a prompt, pick the matching choice" once the
 * payload's already differentiated (word-vs-translation prompt/choices)
 * server-side by game_create_session. */
export function MultipleChoicePlayer({
  gameQuestionId,
  participantId,
  prompt,
  promptLabel,
  choices,
  onAnswered,
}: MultipleChoicePlayerProps) {
  const submitAnswer = useSubmitAnswerMutation()
  const [selected, setSelected] = useState<string | null>(null)
  const [result, setResult] = useState<{ isCorrect: boolean } | null>(null)
  const [startedAt, setStartedAt] = useState(() => Date.now())

  // New question -> reset local state and restart the response-time clock.
  useEffect(() => {
    setSelected(null)
    setResult(null)
    setStartedAt(Date.now())
  }, [gameQuestionId])

  // Brief pause on the feedback state before advancing -- its own
  // effect (rather than a setTimeout inside handleChoose) so it's
  // properly cancelled if the question changes out from under it.
  useEffect(() => {
    if (!result || !onAnswered) return
    const t = setTimeout(() => onAnswered(), 900)
    return () => clearTimeout(t)
  }, [result, onAnswered])

  async function handleChoose(choice: string) {
    if (selected) return
    setSelected(choice)
    try {
      const res = await submitAnswer.mutateAsync({
        gameQuestionId,
        participantId,
        submittedAnswer: { answer: choice },
        responseTimeMs: Date.now() - startedAt,
      })
      setResult({ isCorrect: res.isCorrect })
    } catch {
      setResult(null)
      setSelected(null)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col items-center gap-1 rounded-xl border border-border bg-card px-6 py-10 text-center">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">{promptLabel}</span>
        <span className="text-3xl font-semibold">{prompt}</span>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {choices.map((choice) => {
          const isSelected = selected === choice
          return (
            <button
              key={choice}
              type="button"
              onClick={() => handleChoose(choice)}
              disabled={Boolean(selected)}
              className={cn(
                "flex items-center justify-between gap-2 rounded-lg border px-4 py-3.5 text-left text-base font-medium transition-colors",
                !selected && "border-border hover:border-primary/50",
                isSelected && result?.isCorrect && "border-green-500 bg-green-500/10",
                isSelected && result && !result.isCorrect && "border-red-500 bg-red-500/10",
                isSelected && !result && "border-primary",
                selected && !isSelected && "opacity-50",
              )}
            >
              {choice}
              {isSelected && result?.isCorrect && <Check className="size-4 text-green-600" />}
              {isSelected && result && !result.isCorrect && <X className="size-4 text-red-600" />}
            </button>
          )
        })}
      </div>

      {result && (
        <p className={cn("text-center text-sm font-medium", result.isCorrect ? "text-green-600" : "text-red-600")}>
          {result.isCorrect ? "Correct!" : "Not quite"} {onAnswered ? "-- next question…" : "-- waiting for the next question…"}
        </p>
      )}
    </div>
  )
}
