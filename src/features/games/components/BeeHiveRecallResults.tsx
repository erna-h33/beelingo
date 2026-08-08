import { useMemo } from "react"

import { Badge } from "@/components/ui/badge"
import type { GameAnswerRow } from "@/features/games/useGameAnswers"

interface BeeHiveRecallResultsProps {
  pairs: { wordId: string; word: string }[]
  answers: GameAnswerRow[]
  /** Provided on the student's own completed screen to show their
   * personal correct/missed breakdown (missed words highlighted so
   * they can review them); omitted on the teacher's host view, which
   * only shows the class-wide most-forgotten word. */
  ownParticipantId?: string
}

/**
 * The one piece of the results screen unique to BeeHive Recall --
 * slotted alongside the existing Leaderboard on both the teacher's and
 * student's already-existing "completed" view, not a replacement for
 * it. Built entirely from game_answers, which every game already
 * writes and both roles can already read (0018) -- no new RPC.
 */
export function BeeHiveRecallResults({ pairs, answers, ownParticipantId }: BeeHiveRecallResultsProps) {
  const wordById = useMemo(() => new Map(pairs.map((p) => [p.wordId, p.word])), [pairs])

  const mostForgotten = useMemo(() => {
    const missCounts = new Map<string, number>()
    for (const a of answers) {
      if (a.is_correct) continue
      const wordId = a.submitted_answer?.wordId as string | undefined
      if (!wordId) continue
      missCounts.set(wordId, (missCounts.get(wordId) ?? 0) + 1)
    }
    let best: { word: string; count: number } | null = null
    for (const [wordId, count] of missCounts) {
      if (!best || count > best.count) best = { word: wordById.get(wordId) ?? wordId, count }
    }
    return best
  }, [answers, wordById])

  const own = useMemo(() => {
    if (!ownParticipantId) return null
    const correctWordIds = new Set(
      answers
        .filter((a) => a.game_session_participant_id === ownParticipantId && a.is_correct)
        .map((a) => a.submitted_answer?.wordId as string | undefined)
        .filter((id): id is string => Boolean(id)),
    )
    return {
      correct: pairs.filter((p) => correctWordIds.has(p.wordId)).map((p) => p.word),
      missed: pairs.filter((p) => !correctWordIds.has(p.wordId)).map((p) => p.word),
    }
  }, [answers, ownParticipantId, pairs])

  if (!own && !mostForgotten) return null

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
      <p className="text-sm font-medium">BeeHive Recall results</p>

      {own && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">
              Words correct ({own.correct.length})
            </p>
            <div className="flex flex-wrap gap-1">
              {own.correct.length === 0 && <span className="text-xs text-muted-foreground">None yet</span>}
              {own.correct.map((w) => (
                <Badge key={w} variant="outline" className="border-success/40 text-success">
                  {w}
                </Badge>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Words missed ({own.missed.length})</p>
            <div className="flex flex-wrap gap-1">
              {own.missed.length === 0 && <span className="text-xs text-muted-foreground">None -- perfect recall!</span>}
              {own.missed.map((w) => (
                <Badge key={w} variant="outline" className="border-destructive/40 text-destructive">
                  {w}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      )}

      {mostForgotten && (
        <p className="text-xs text-muted-foreground">
          Most forgotten word: <span className="font-medium text-foreground">{mostForgotten.word}</span>
        </p>
      )}
    </div>
  )
}
