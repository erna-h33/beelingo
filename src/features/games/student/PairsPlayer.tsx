import { useEffect, useMemo, useState } from "react"

import { cn } from "@/lib/utils"
import { useSubmitAnswerMutation } from "@/features/games/useGameActions"

interface Pair {
  wordId: string
  word: string
  translation: string
}

interface PairsPlayerProps {
  gameQuestionId: string
  participantId: string
  pairs: Pair[]
  mode: "matching" | "memory_challenge"
}

function shuffled<T>(arr: T[]): T[] {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

/**
 * Shared by Matching (both columns visible, tap-to-pair) and Memory
 * Challenge (face-down grid, flip-two-to-check) -- both submit the same
 * {wordId, guess} shape to game_submit_answer, which is the only place
 * that actually knows whether a pairing is correct (0019/0020). The
 * word/translation columns (or card pool) are shuffled independently of
 * each other so tapping in payload order doesn't trivially solve it.
 */
export function PairsPlayer({ gameQuestionId, participantId, pairs, mode }: PairsPlayerProps) {
  const submitAnswer = useSubmitAnswerMutation()
  const [solvedWordIds, setSolvedWordIds] = useState<Set<string>>(new Set())

  // Matching mode state
  const [selectedWordId, setSelectedWordId] = useState<string | null>(null)
  const [selectedTranslationKey, setSelectedTranslationKey] = useState<string | null>(null)
  const [wrongFlash, setWrongFlash] = useState<{ wordId: string; translationKey: string } | null>(null)
  const wordCards = useMemo(() => shuffled(pairs.map((p) => ({ wordId: p.wordId, word: p.word }))), [pairs])
  const translationCards = useMemo(
    () => shuffled(pairs.map((p, i) => ({ key: `t-${i}`, value: p.translation }))),
    [pairs],
  )
  const [solvedTranslationKeys, setSolvedTranslationKeys] = useState<Set<string>>(new Set())

  // Memory mode state
  interface MemoryCard {
    key: string
    role: "word" | "translation"
    wordId: string
    label: string
  }
  const cardPool = useMemo<MemoryCard[]>(
    () =>
      shuffled([
        ...pairs.map((p) => ({ key: `w-${p.wordId}`, role: "word" as const, wordId: p.wordId, label: p.word })),
        ...pairs.map((p, i) => ({
          key: `t-${p.wordId}-${i}`,
          role: "translation" as const,
          wordId: p.wordId,
          label: p.translation,
        })),
      ]),
    [pairs],
  )
  const [flippedKeys, setFlippedKeys] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setSolvedWordIds(new Set())
    setSolvedTranslationKeys(new Set())
    setSelectedWordId(null)
    setSelectedTranslationKey(null)
    setFlippedKeys([])
    setBusy(false)
  }, [gameQuestionId])

  async function attemptMatch(wordId: string, guess: string, translationKeyForFlash?: string) {
    try {
      const res = await submitAnswer.mutateAsync({ gameQuestionId, participantId, submittedAnswer: { wordId, guess } })
      if (res.isCorrect) {
        setSolvedWordIds((prev) => new Set(prev).add(wordId))
        if (translationKeyForFlash) setSolvedTranslationKeys((prev) => new Set(prev).add(translationKeyForFlash))
      }
      return res.isCorrect
    } catch {
      return false
    }
  }

  // -- Matching mode --------------------------------------------------
  async function handleWordTap(wordId: string) {
    if (solvedWordIds.has(wordId)) return
    setSelectedWordId(wordId)
    if (selectedTranslationKey) await tryMatchingPair(wordId, selectedTranslationKey)
  }
  async function handleTranslationTap(key: string, value: string) {
    if (solvedTranslationKeys.has(key)) return
    setSelectedTranslationKey(key)
    if (selectedWordId) await tryMatchingPair(selectedWordId, key, value)
  }
  async function tryMatchingPair(wordId: string, translationKey: string, valueOverride?: string) {
    const value = valueOverride ?? translationCards.find((t) => t.key === translationKey)?.value ?? ""
    const correct = await attemptMatch(wordId, value, translationKey)
    if (!correct) {
      setWrongFlash({ wordId, translationKey })
      setTimeout(() => setWrongFlash(null), 500)
    }
    setSelectedWordId(null)
    setSelectedTranslationKey(null)
  }

  // -- Memory mode ------------------------------------------------------
  async function handleCardTap(card: MemoryCard) {
    if (busy || solvedWordIds.has(card.wordId) || flippedKeys.includes(card.key)) return

    if (flippedKeys.length === 0) {
      setFlippedKeys([card.key])
      return
    }

    const firstCard = cardPool.find((c) => c.key === flippedKeys[0])
    if (!firstCard) return
    setFlippedKeys([flippedKeys[0], card.key])

    if (firstCard.role === card.role) {
      setBusy(true)
      setTimeout(() => {
        setFlippedKeys([])
        setBusy(false)
      }, 700)
      return
    }

    setBusy(true)
    const wordCard = firstCard.role === "word" ? firstCard : card
    const translationCard = firstCard.role === "translation" ? firstCard : card
    const correct = await attemptMatch(wordCard.wordId, translationCard.label)
    setTimeout(() => {
      setFlippedKeys([])
      setBusy(false)
      if (!correct) return
    }, 700)
  }

  const total = pairs.length
  const solvedCount = solvedWordIds.size

  if (mode === "matching") {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-center text-sm text-muted-foreground">
          {solvedCount} / {total} matched
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            {wordCards.map((c) => (
              <button
                key={c.wordId}
                type="button"
                disabled={solvedWordIds.has(c.wordId)}
                onClick={() => handleWordTap(c.wordId)}
                className={cn(
                  "rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors",
                  solvedWordIds.has(c.wordId) && "border-green-500 bg-green-500/10 text-muted-foreground",
                  !solvedWordIds.has(c.wordId) && selectedWordId === c.wordId && "border-primary bg-primary/5",
                  wrongFlash?.wordId === c.wordId && "border-red-500 bg-red-500/10",
                  !solvedWordIds.has(c.wordId) && selectedWordId !== c.wordId && "border-border",
                )}
              >
                {c.word}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-2">
            {translationCards.map((c) => (
              <button
                key={c.key}
                type="button"
                disabled={solvedTranslationKeys.has(c.key)}
                onClick={() => handleTranslationTap(c.key, c.value)}
                className={cn(
                  "rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors",
                  solvedTranslationKeys.has(c.key) && "border-green-500 bg-green-500/10 text-muted-foreground",
                  !solvedTranslationKeys.has(c.key) &&
                    selectedTranslationKey === c.key &&
                    "border-primary bg-primary/5",
                  wrongFlash?.translationKey === c.key && "border-red-500 bg-red-500/10",
                  !solvedTranslationKeys.has(c.key) && selectedTranslationKey !== c.key && "border-border",
                )}
              >
                {c.value}
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-center text-sm text-muted-foreground">
        {solvedCount} / {total} matched
      </p>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {cardPool.map((c) => {
          const isSolved = solvedWordIds.has(c.wordId)
          const isFlipped = flippedKeys.includes(c.key) || isSolved
          return (
            <button
              key={c.key}
              type="button"
              disabled={isSolved || busy}
              onClick={() => handleCardTap(c)}
              className={cn(
                "flex aspect-square items-center justify-center rounded-lg border p-2 text-center text-sm font-medium transition-colors",
                isSolved && "border-green-500 bg-green-500/10 text-muted-foreground",
                isFlipped && !isSolved && "border-primary bg-primary/5",
                !isFlipped && "border-border bg-muted",
              )}
            >
              {isFlipped ? c.label : "?"}
            </button>
          )
        })}
      </div>
    </div>
  )
}
