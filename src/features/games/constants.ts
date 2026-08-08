import type { GameType, WordSetFilter } from "@/lib/supabase/types"

export const GAME_TYPE_LABEL: Record<GameType, string> = {
  speed_translation: "Speed Translation",
  reverse_translation: "Reverse Translation",
  typing_challenge: "Typing Challenge",
  fill_in_blank: "Fill in the Blank",
  team_battle: "Team Battle",
  matching: "Matching",
  memory_challenge: "Memory Challenge",
  flashcards: "Flashcards",
  beehive_recall: "BeeHive Recall",
}

export const GAME_TYPE_DESCRIPTION: Record<GameType, string> = {
  speed_translation: "See the word, pick the right translation.",
  reverse_translation: "See the translation, pick the right word.",
  typing_challenge: "See the translation, type the word from memory.",
  fill_in_blank: "Fill in the missing word in a practice sentence.",
  team_battle: "Speed Translation, scored by team.",
  matching: "Match every word to its translation.",
  memory_challenge: "Flip cards to find matching pairs.",
  flashcards: "Self-paced review -- flip to reveal the translation.",
  beehive_recall: "Study a group of words, then type everything you remember.",
}

export type RecallDifficulty = "easy" | "medium" | "hard" | "expert"

export const RECALL_DIFFICULTY_LABEL: Record<RecallDifficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
  expert: "Expert",
}

/** Word count and study-display duration are both derived from
 * difficulty for BeeHive Recall, rather than a free "number of words"
 * input like every other game type -- these presets are the whole
 * knob. `answerSeconds` (how long students get to type) stays
 * separately teacher-configurable, default 30, per the spec. */
export const RECALL_DIFFICULTY_PRESETS: Record<RecallDifficulty, { wordCount: number; displaySeconds: number }> = {
  easy: { wordCount: 3, displaySeconds: 5 },
  medium: { wordCount: 5, displaySeconds: 8 },
  hard: { wordCount: 8, displaySeconds: 12 },
  expert: { wordCount: 10, displaySeconds: 15 },
}

export const RECALL_DEFAULT_ANSWER_SECONDS = 30

/** fill_in_blank needs a practice_sentence on every eligible word. */
export const GAME_TYPE_REQUIRES_PRACTICE_SENTENCE: Partial<Record<GameType, boolean>> = {
  fill_in_blank: true,
}

export const WORD_SET_FILTER_LABEL: Record<WordSetFilter, string> = {
  today: "Today's Words",
  random: "Random",
  entire_hive: "Entire Hive",
  by_topic: "Specific Topic",
}

export const WORD_SET_FILTER_DESCRIPTION: Record<WordSetFilter, string> = {
  today: "Words added today, weighted toward ones the class is still learning.",
  random: "A uniform, unweighted mix -- just for fun.",
  entire_hive: "The whole class Hive, weighted toward ones the class is still learning.",
  by_topic: "Just one topic, weighted toward ones the class is still learning.",
}
