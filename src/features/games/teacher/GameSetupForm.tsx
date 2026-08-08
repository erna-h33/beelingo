import { useMemo, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { GameType, WordSetFilter } from "@/lib/supabase/types"
import {
  GAME_TYPE_DESCRIPTION,
  GAME_TYPE_LABEL,
  RECALL_DEFAULT_ANSWER_SECONDS,
  RECALL_DIFFICULTY_LABEL,
  RECALL_DIFFICULTY_PRESETS,
  WORD_SET_FILTER_DESCRIPTION,
  WORD_SET_FILTER_LABEL,
  type RecallDifficulty,
} from "@/features/games/constants"
import { useCreateGameSessionMutation } from "@/features/games/useGameActions"
import { useHiveWordsQuery } from "@/features/hive/useHiveWords"

const GAME_TYPES: GameType[] = [
  "speed_translation",
  "reverse_translation",
  "typing_challenge",
  "fill_in_blank",
  "team_battle",
  "matching",
  "memory_challenge",
  "flashcards",
  "beehive_recall",
]

const RECALL_DIFFICULTIES: RecallDifficulty[] = ["easy", "medium", "hard", "expert"]

const WORD_SET_FILTERS: WordSetFilter[] = ["today", "random", "entire_hive", "by_topic"]

interface GameSetupFormProps {
  classId: string
  onCreated: (sessionId: string) => void
}

/** The "what should this game be" form -- the setup half of hosting;
 * useGameActions.useCreateGameSessionMutation does the actual weighted
 * question-set build server-side. */
export function GameSetupForm({ classId, onCreated }: GameSetupFormProps) {
  const { data: words } = useHiveWordsQuery(classId)
  const createSession = useCreateGameSessionMutation()

  const [gameType, setGameType] = useState<GameType>("speed_translation")
  const [wordSetFilter, setWordSetFilter] = useState<WordSetFilter>("entire_hive")
  const [topic, setTopic] = useState("")
  const [questionCount, setQuestionCount] = useState(8)
  const [teamCount, setTeamCount] = useState(2)
  const [recallDifficulty, setRecallDifficulty] = useState<RecallDifficulty>("medium")
  const [recallAnswerSeconds, setRecallAnswerSeconds] = useState(RECALL_DEFAULT_ANSWER_SECONDS)

  const isRecall = gameType === "beehive_recall"

  const topics = useMemo(
    () => [...new Set((words ?? []).map((w) => w.topic).filter((t): t is string => Boolean(t)))].sort(),
    [words],
  )

  const canSubmit = wordSetFilter !== "by_topic" || Boolean(topic)

  async function handleStart() {
    try {
      const recallPreset = RECALL_DIFFICULTY_PRESETS[recallDifficulty]
      const result = await createSession.mutateAsync({
        classId,
        gameType,
        wordSetFilter,
        questionCount: isRecall ? recallPreset.wordCount : questionCount,
        topic: wordSetFilter === "by_topic" ? topic : undefined,
        teamCount: gameType === "team_battle" ? teamCount : undefined,
        displaySeconds: isRecall ? recallPreset.displaySeconds : undefined,
        answerSeconds: isRecall ? recallAnswerSeconds : undefined,
      })
      onCreated(result.sessionId)
    } catch (error) {
      toast.error("Couldn't start game", {
        description: error instanceof Error ? error.message : undefined,
      })
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label>Game type</Label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {GAME_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setGameType(type)}
              className={`flex flex-col gap-0.5 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                gameType === type
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/40"
              }`}
            >
              <span className="font-medium">{GAME_TYPE_LABEL[type]}</span>
              <span className="text-xs text-muted-foreground">{GAME_TYPE_DESCRIPTION[type]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label>Word source</Label>
          <Select value={wordSetFilter} onValueChange={(v) => setWordSetFilter(v as WordSetFilter)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WORD_SET_FILTERS.map((f) => (
                <SelectItem key={f} value={f}>
                  {WORD_SET_FILTER_LABEL[f]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{WORD_SET_FILTER_DESCRIPTION[wordSetFilter]}</p>
        </div>

        {wordSetFilter === "by_topic" && (
          <div className="flex flex-col gap-2">
            <Label>Topic</Label>
            <Select value={topic} onValueChange={setTopic}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a topic" />
              </SelectTrigger>
              <SelectContent>
                {topics.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {topics.length === 0 && (
              <p className="text-xs text-muted-foreground">No topics tagged in the Hive yet.</p>
            )}
          </div>
        )}

        {!isRecall && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="question-count">Number of words</Label>
            <Input
              id="question-count"
              type="number"
              min={2}
              max={30}
              value={questionCount}
              onChange={(e) => setQuestionCount(Number(e.target.value) || 2)}
            />
          </div>
        )}

        {isRecall && (
          <div className="flex flex-col gap-2">
            <Label>Difficulty</Label>
            <Select value={recallDifficulty} onValueChange={(v) => setRecallDifficulty(v as RecallDifficulty)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RECALL_DIFFICULTIES.map((d) => {
                  const preset = RECALL_DIFFICULTY_PRESETS[d]
                  return (
                    <SelectItem key={d} value={d}>
                      {RECALL_DIFFICULTY_LABEL[d]} -- {preset.wordCount} words, {preset.displaySeconds}s
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>
        )}

        {isRecall && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="recall-answer-seconds">Answer time (seconds)</Label>
            <Input
              id="recall-answer-seconds"
              type="number"
              min={10}
              max={120}
              value={recallAnswerSeconds}
              onChange={(e) => setRecallAnswerSeconds(Number(e.target.value) || RECALL_DEFAULT_ANSWER_SECONDS)}
            />
          </div>
        )}

        {gameType === "team_battle" && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="team-count">Number of teams</Label>
            <Input
              id="team-count"
              type="number"
              min={2}
              max={6}
              value={teamCount}
              onChange={(e) => setTeamCount(Number(e.target.value) || 2)}
            />
          </div>
        )}
      </div>

      <Button onClick={handleStart} disabled={!canSubmit || createSession.isPending} size="lg">
        {createSession.isPending ? "Creating…" : "Create game"}
      </Button>
    </div>
  )
}
