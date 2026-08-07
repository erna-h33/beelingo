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
}

export const GAME_TYPE_DESCRIPTION: Record<GameType, string> = {
  speed_translation: "See the word, pick the right translation.",
  reverse_translation: "See the translation, pick the right word.",
  typing_challenge: "Type the translation from memory.",
  fill_in_blank: "Fill in the missing word in a practice sentence.",
  team_battle: "Speed Translation, scored by team.",
  matching: "Match every word to its translation.",
  memory_challenge: "Flip cards to find matching pairs.",
  flashcards: "Self-paced review -- flip to reveal the translation.",
}

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
