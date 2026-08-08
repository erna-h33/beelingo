import { useEffect, useRef, useState } from "react"
import { Sparkles } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useSubmitAnswerMutation } from "@/features/games/useGameActions"
import type { QuestionPayload } from "@/features/games/useGameQuestions"

type RecallPayload = Extract<QuestionPayload, { type: "beehive_recall" }>

interface BeeHiveRecallPlayerProps {
  gameQuestionId: string
  participantId: string
  payload: RecallPayload
}

type Phase = "study" | "fading" | "go" | "answer" | "submitting" | "submitted"

/**
 * The one genuinely new piece of gameplay UI this game type needed --
 * everything else (session lifecycle, scoring, leaderboard, mastery
 * update) is the same games engine every other game already uses. This
 * component just drives the study -> countdown -> fade -> GO -> answer
 * sequence locally, then submits one game_submit_answer call per word
 * in the round (reusing the exact same pairs-grading path Matching
 * uses) -- correct guesses for words the student typed, deliberately
 * wrong (empty) guesses for words they missed, so every word in the
 * round gets a real game_answers row and the Adaptive Review Engine
 * sees "forgotten" words too, not just wrong-typed ones.
 */
export function BeeHiveRecallPlayer({ gameQuestionId, participantId, payload }: BeeHiveRecallPlayerProps) {
  const submitAnswer = useSubmitAnswerMutation()
  const [phase, setPhase] = useState<Phase>("study")
  const [studySecondsLeft, setStudySecondsLeft] = useState(payload.displaySeconds)
  const [answerSecondsLeft, setAnswerSecondsLeft] = useState(payload.answerSeconds)
  const [text, setText] = useState("")
  const [recalledCount, setRecalledCount] = useState<number | null>(null)
  const submittedRef = useRef(false)

  // Reset if a brand new round somehow mounts this component again.
  useEffect(() => {
    setPhase("study")
    setStudySecondsLeft(payload.displaySeconds)
    setAnswerSecondsLeft(payload.answerSeconds)
    setText("")
    setRecalledCount(null)
    submittedRef.current = false
  }, [gameQuestionId, payload.displaySeconds, payload.answerSeconds])

  // Study countdown -> fading. Each phase transition below gets its own
  // effect keyed on entering that exact phase, scheduling only the ONE
  // immediate next transition -- chaining multiple setTimeouts inside a
  // single effect that also changes `phase` (a dependency of that same
  // effect) causes the effect's own cleanup to cancel the later timer
  // the moment the earlier one fires and re-renders, since React reruns
  // (and thus cleans up) the effect as soon as any dependency changes.
  useEffect(() => {
    if (phase !== "study") return
    if (studySecondsLeft <= 0) {
      setPhase("fading")
      return
    }
    const t = setTimeout(() => setStudySecondsLeft((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [phase, studySecondsLeft])

  // Fading -> GO.
  useEffect(() => {
    if (phase !== "fading") return
    const t = setTimeout(() => setPhase("go"), 450)
    return () => clearTimeout(t)
  }, [phase])

  // GO -> answer.
  useEffect(() => {
    if (phase !== "go") return
    const t = setTimeout(() => setPhase("answer"), 700)
    return () => clearTimeout(t)
  }, [phase])

  // Answer countdown -> auto-submit at zero.
  useEffect(() => {
    if (phase !== "answer") return
    if (answerSecondsLeft <= 0) {
      handleSubmit()
      return
    }
    const t = setTimeout(() => setAnswerSecondsLeft((s) => s - 1), 1000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handleSubmit is stable enough for this loop's purposes
  }, [phase, answerSecondsLeft])

  async function handleSubmit() {
    if (submittedRef.current) return
    submittedRef.current = true
    setPhase("submitting")

    const typedLines = text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
    const typedNormalized = typedLines.map((line) => line.toLowerCase())

    let matched = 0
    const submissions = payload.pairs.map((pair) => {
      const targetNormalized = pair.word.trim().toLowerCase()
      const idx = typedNormalized.indexOf(targetNormalized)
      if (idx >= 0) matched += 1
      // A deliberately-wrong empty guess for anything not recalled --
      // ensures every word in the round gets a real game_answers row,
      // so a forgotten word (never typed, not just mistyped) still
      // shows up for "Most Forgotten Word" and still pulls its
      // mastery_score down, per the Adaptive Review Engine.
      const guess = idx >= 0 ? typedLines[idx] : ""
      return { wordId: pair.wordId, guess }
    })

    setRecalledCount(matched)

    await Promise.all(
      submissions.map((s) =>
        submitAnswer
          .mutateAsync({ gameQuestionId, participantId, submittedAnswer: { wordId: s.wordId, guess: s.guess } })
          .catch(() => {
            // Already-submitted races etc. -- non-fatal, the server is
            // the source of truth either way.
          }),
      ),
    )

    setPhase("submitted")
  }

  if (phase === "study" || phase === "fading") {
    return (
      <div className="flex flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-1">
          <span className="text-4xl font-bold tabular-nums text-primary">{studySecondsLeft}</span>
          <span className="text-xs text-muted-foreground">Study these words</span>
        </div>
        <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-1000 ease-linear"
            style={{ width: `${(studySecondsLeft / payload.displaySeconds) * 100}%` }}
          />
        </div>
        <div
          className={cn(
            "grid w-full grid-cols-1 gap-3 transition-opacity duration-500 sm:grid-cols-2",
            phase === "fading" ? "opacity-0" : "opacity-100",
          )}
        >
          {payload.pairs.map((pair) => (
            <div
              key={pair.wordId}
              className="rounded-xl border border-border bg-card px-4 py-6 text-center text-3xl font-bold sm:text-2xl"
            >
              {pair.word}
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (phase === "go") {
    return (
      <div className="flex min-h-56 flex-col items-center justify-center gap-2">
        <span className="animate-in zoom-in-50 fade-in text-6xl font-black text-primary duration-500">GO!</span>
      </div>
    )
  }

  if (phase === "answer" || phase === "submitting") {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Type every word you remember -- one per line</span>
          <span className="text-lg font-bold tabular-nums text-primary">{answerSecondsLeft}s</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-1000 ease-linear"
            style={{ width: `${(answerSecondsLeft / payload.answerSeconds) * 100}%` }}
          />
        </div>
        <Textarea
          autoFocus
          rows={8}
          placeholder={"perro\ngato\n..."}
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={phase === "submitting"}
          className="text-base"
        />
        <Button size="lg" onClick={handleSubmit} disabled={phase === "submitting"}>
          {phase === "submitting" ? "Submitting…" : "Submit"}
        </Button>
      </div>
    )
  }

  // submitted
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-12 text-center">
      <Sparkles className="size-8 text-muted-foreground" />
      <p className="font-medium">
        {recalledCount !== null && `You recalled ${recalledCount} of ${payload.pairs.length} words!`}
      </p>
      <p className="text-sm text-muted-foreground">Waiting for your teacher to end the round…</p>
    </div>
  )
}
