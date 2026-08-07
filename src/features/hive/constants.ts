/** Fixed option lists for word type / gender, so entries stay consistent
 * (matters once games/M9 start branching on these) whether a teacher
 * typed them by hand or Wikidata's lookup filled them in -- kept in sync
 * with the WORD_TYPE_BY_QID / GENDER_BY_QID maps in
 * supabase/functions/enrich-word/index.ts. */
export const WORD_TYPE_OPTIONS = [
  "noun",
  "verb",
  "adjective",
  "adverb",
  "pronoun",
  "preposition",
  "conjunction",
  "interjection",
  "numeral",
  "determiner",
  "phrase",
  "other",
] as const

export const GENDER_OPTIONS = ["masculine", "feminine", "neuter", "common"] as const
