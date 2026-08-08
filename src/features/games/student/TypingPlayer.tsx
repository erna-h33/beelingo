import { useEffect, useState } from "react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useSubmitAnswerMutation } from "@/features/games/useGameActions"

interface TypingPlayerProps {
  gameQuestionId: string
  participantId: string
  promptLabel: string
  /** typing_challenge: the word itself, prompting for its translation.
   * fill_in_blank: the masked sentence, prompting for the missing word. */
  prompt: string
  placeholder: string
  /** Self-paced games only: called ~900ms after a correct/incorrect
   * result is shown, once per question. See MultipleChoicePlayer's
   * identical prop for why this lives in its own effect. */
  onAnswered?: () => void
}

/** Shared by typing_challenge and fill_in_blank -- both are "type the
 * missing text and submit," differing only in what's shown/asked. */
export function TypingPlayer({
  gameQuestionId,
  participantId,
  promptLabel,
  prompt,
  placeholder,
  onAnswered,
}: TypingPlayerProps) {
  const submitAnswer = useSubmitAnswerMutation()
  const [value, setValue] = useState("")
  const [result, setResult] = useState<{ isCorrect: boolean } | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [startedAt, setStartedAt] = useState(() => Date.now())

  useEffect(() => {
    setValue("")
    setResult(null)
    setSubmitted(false)
    setStartedAt(Date.now())
  }, [gameQuestionId])

  useEffect(() => {
    if (!result || !onAnswered) return
    const t = setTimeout(() => onAnswered(), 900)
    return () => clearTimeout(t)
  }, [result, onAnswered])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitted || !value.trim()) return
    setSubmitted(true)
    try {
      const res = await submitAnswer.mutateAsync({
        gameQuestionId,
        participantId,
        submittedAnswer: { answer: value.trim() },
        responseTimeMs: Date.now() - startedAt,
      })
      setResult({ isCorrect: res.isCorrect })
    } catch {
      setSubmitted(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col items-center gap-1 rounded-xl border border-border bg-card px-6 py-10 text-center">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">{promptLabel}</span>
        <span className="text-2xl font-semibold">{prompt}</span>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
        <Input
          autoFocus
          placeholder={placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={submitted}
          className={cn(
            result?.isCorrect && "border-green-500",
            result && !result.isCorrect && "border-red-500",
          )}
        />
        <Button type="submit" disabled={submitted || !value.trim()} size="lg">
          Submit
        </Button>
      </form>

      {result && (
        <p className={cn("text-center text-sm font-medium", result.isCorrect ? "text-green-600" : "text-red-600")}>
          {result.isCorrect ? "Correct!" : "Not quite"} {onAnswered ? "-- next question…" : "-- waiting for the next question…"}
        </p>
      )}
    </div>
  )
}
