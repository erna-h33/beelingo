/**
 * Hand-written Supabase database types, covering the tables that exist so
 * far (M2: languages, teachers, classes; M3: class_students; M4:
 * student_devices + the join-flow RPC functions; M5: hive_words).
 * Replace/extend this by running `supabase gen types typescript --db-url ...`
 * once Docker (or a CI runner) is available to run it -- it needs a
 * container runtime that isn't present in this dev environment.
 *
 * `Relationships: []` on every table is required by @supabase/postgrest-js's
 * `GenericTable` shape (as is the top-level `Views`/`Functions`) -- without
 * it the client silently loses all type inference and every Row/Insert/
 * Update collapses to `never`. Keep it even though we don't lean on
 * PostgREST's embedded-relationship typing (embedded selects are cast
 * manually where used, e.g. `ClassSummary` in features/classes/useClasses.ts).
 */

interface LanguageRefJson {
  code: string
  name: string
  flagEmoji: string | null
}

/** `get_my_student_session` additionally returns DeepL codes per
 * language -- lookup_class_by_code/join_class don't, so this stays a
 * separate shape rather than forcing fields onto LanguageRefJson that
 * some RPCs don't actually return. */
interface LanguageRefWithDeepLJson extends LanguageRefJson {
  deeplSourceCode: string | null
  deeplTargetCode: string | null
}

/** Return shape of the `lookup_class_by_code` RPC (0010) -- `null` when
 * the code doesn't match any active class. */
export interface LookupClassResult {
  class: {
    id: string
    name: string
    learningLanguage: LanguageRefJson
    displayLanguage: LanguageRefJson
  }
  roster: { id: string; displayName: string }[]
}

/** Return shape of the `join_class` RPC (0010). */
export interface JoinClassResult {
  classStudentId: string
  displayName: string
  classId: string
}

/** Return shape of the `get_my_student_session` RPC (0010/0012) -- `null`
 * when the caller's device isn't linked to any active roster entry. */
export interface StudentSessionResult {
  classStudentId: string
  displayName: string
  classId: string
  className: string
  learningLanguage: LanguageRefWithDeepLJson
  displayLanguage: LanguageRefWithDeepLJson
}

/** Return shape of the `contribute_word` RPC (0014). */
export interface ContributeWordResult {
  hiveWordId: string
  word: string
  translation: string | null
  isNew: boolean
}

export type GameType =
  | "matching"
  | "flashcards"
  | "speed_translation"
  | "reverse_translation"
  | "typing_challenge"
  | "memory_challenge"
  | "fill_in_blank"
  | "team_battle"
  | "beehive_recall"

export type WordSetFilter = "today" | "random" | "entire_hive" | "by_topic"

/** Return shape of the `game_create_session` RPC (0019). */
export interface GameCreateSessionResult {
  sessionId: string
  questionCount: number
}

export interface GameStartSessionResult {
  sessionId: string
  status: "active"
}

export interface GameAdvanceQuestionResult {
  currentQuestionIndex: number
  isLast: boolean
}

export interface GameSubmitAnswerResult {
  isCorrect: boolean
  pointsAwarded: number
}

export interface GameEndSessionResult {
  sessionId: string
  status: "completed"
}

/** One row of the `class_word_stats` RPC (0023) -- cumulative miss-rate
 * across every game the class has ever played. Deliberately never
 * includes mastery_score: this is a different, independently-computed
 * signal, kept separate so the internal adaptive-engine score stays
 * fully internal even here. */
export interface ClassWordStat {
  hiveWordId: string
  word: string
  translation: string | null
  topic: string | null
  attempts: number
  correct: number
  missRate: number
}

/** One row of the `class_student_stats` RPC (0023). */
export interface ClassStudentStat {
  classStudentId: string
  displayName: string
  gamesPlayed: number
  totalScore: number
  correctCount: number
  incorrectCount: number
}

/** One row of `teacher_dashboard_stats`' topContributors (0024). */
export interface TopContributor {
  classStudentId: string
  displayName: string
  className: string
  contributionCount: number
}

/** One row of `teacher_dashboard_stats`' mostMissedWords (0024) --
 * same shape as ClassWordStat plus a className label since results
 * span every class the teacher owns. */
export interface TeacherMostMissedWord {
  hiveWordId: string
  word: string
  translation: string | null
  className: string
  attempts: number
  correct: number
  missRate: number
}

/** Return shape of the `teacher_dashboard_stats` RPC (0024). */
export interface TeacherDashboardStats {
  totalClasses: number
  totalHiveWords: number
  newWordsThisWeek: number
  totalActiveStudents: number
  totalGamesPlayed: number
  averageAccuracy: number | null
  topContributors: TopContributor[]
  mostMissedWords: TeacherMostMissedWord[]
}

/** Return shape of the `student_dashboard_stats` RPC (0024).
 * `wordsLearned` is a proxy metric (distinct words answered correctly
 * at least once) -- deliberately not mastery_score, which stays fully
 * internal even here. */
export interface StudentDashboardStats {
  gamesPlayed: number
  correctCount: number
  incorrectCount: number
  contributionsCount: number
  wordsLearned: number
  streakDays: number
}

export interface Database {
  public: {
    Tables: {
      languages: {
        Row: {
          id: string
          code: string
          name: string
          native_name: string
          flag_emoji: string | null
          deepl_source_code: string | null
          deepl_target_code: string | null
          created_at: string
        }
        Insert: never // seed-only table, not client-writable
        Update: never
        Relationships: []
      }
      teachers: {
        Row: {
          id: string
          email: string
          display_name: string | null
          created_at: string
        }
        Insert: never // created by the signup trigger, not client-writable
        Update: {
          display_name?: string | null
        }
        Relationships: []
      }
      classes: {
        Row: {
          id: string
          teacher_id: string
          name: string
          class_code: string
          learning_language_id: string
          display_language_id: string
          created_at: string
          archived_at: string | null
        }
        Insert: {
          id?: string
          teacher_id: string
          name: string
          // Omit to let the `classes_assign_code` trigger generate one.
          class_code?: string
          learning_language_id: string
          display_language_id?: string
          archived_at?: string | null
        }
        Update: {
          name?: string
          learning_language_id?: string
          display_language_id?: string
          archived_at?: string | null
        }
        Relationships: []
      }
      class_students: {
        Row: {
          id: string
          class_id: string
          display_name: string
          is_active: boolean
          joined_at: string
        }
        Insert: {
          id?: string
          class_id: string
          display_name: string
          is_active?: boolean
        }
        Update: {
          display_name?: string
          is_active?: boolean
        }
        Relationships: []
      }
      student_devices: {
        Row: {
          id: string
          class_student_id: string
          auth_user_id: string
          last_seen_at: string
          created_at: string
        }
        // Only ever written via the `join_class` RPC (SECURITY DEFINER,
        // bypasses RLS) -- no direct client insert/update path exists.
        Insert: never
        Update: never
        Relationships: []
      }
      hive_words: {
        Row: {
          id: string
          class_id: string
          word: string
          translation: string | null
          word_type: string | null
          gender: string | null
          plural: string | null
          practice_sentence: string | null
          teacher_notes: string | null
          teacher_audio_path: string | null
          topic: string | null
          source: "student" | "teacher" | "ocr"
          added_by_class_student_id: string | null
          verified: boolean
          verified_at: string | null
          mastery_score: number
          translation_source: "deepl" | "manual" | "none"
          translated_at: string | null
          lexical_source: "wikidata" | "none"
          lexical_fetched_at: string | null
          enrichment_status: "pending" | "success" | "partial" | "failed"
          created_at: string
        }
        Insert: {
          id?: string
          class_id: string
          word: string
          translation?: string | null
          word_type?: string | null
          gender?: string | null
          plural?: string | null
          practice_sentence?: string | null
          teacher_notes?: string | null
          topic?: string | null
          source: "student" | "teacher" | "ocr"
          added_by_class_student_id?: string | null
          verified?: boolean
          verified_at?: string | null
          translation_source?: "deepl" | "manual" | "none"
          translated_at?: string | null
          lexical_source?: "wikidata" | "none"
          lexical_fetched_at?: string | null
          enrichment_status?: "pending" | "success" | "partial" | "failed"
        }
        Update: {
          word?: string
          translation?: string | null
          word_type?: string | null
          gender?: string | null
          plural?: string | null
          practice_sentence?: string | null
          teacher_notes?: string | null
          teacher_audio_path?: string | null
          topic?: string | null
          verified?: boolean
          verified_at?: string | null
          translation_source?: "deepl" | "manual" | "none"
          translated_at?: string | null
          lexical_source?: "wikidata" | "none"
          lexical_fetched_at?: string | null
          enrichment_status?: "pending" | "success" | "partial" | "failed"
        }
        Relationships: []
      }
      word_contributions: {
        Row: {
          id: string
          hive_word_id: string
          class_id: string
          class_student_id: string
          contributed_at: string
          is_first_contribution: boolean
        }
        // Only ever written via the `contribute_word` RPC (SECURITY
        // DEFINER, bypasses RLS) -- no direct client insert path exists.
        Insert: never
        Update: never
        Relationships: []
      }
      game_sessions: {
        Row: {
          id: string
          class_id: string
          teacher_id: string
          game_type: GameType
          word_set_filter: WordSetFilter
          status: "waiting" | "active" | "completed" | "cancelled"
          settings: {
            questionCount?: number
            topic?: string
            teamCount?: number
            displaySeconds?: number
            answerSeconds?: number
            /** The actual number of questions created (can be less than
             * questionCount if the Hive pool was smaller) -- set by
             * game_create_session (0030), used by self-paced students'
             * clients to know when they've reached the end. */
            totalQuestions?: number
          }
          current_question_index: number
          started_at: string | null
          ended_at: string | null
          created_at: string
        }
        // Only ever written via game_create_session/game_start_session/
        // game_end_session (all SECURITY DEFINER).
        Insert: never
        Update: never
        Relationships: []
      }
      game_session_participants: {
        Row: {
          id: string
          game_session_id: string
          class_student_id: string
          team: string | null
          score: number
          correct_count: number
          incorrect_count: number
          joined_at: string
          last_seen_at: string
        }
        Insert: {
          id?: string
          game_session_id: string
          class_student_id: string
        }
        // Score/team fields are only ever written via game_submit_answer/
        // game_start_session (SECURITY DEFINER) -- no client update path.
        Update: never
        Relationships: []
      }
      game_questions: {
        Row: {
          id: string
          game_session_id: string
          sequence_index: number
          hive_word_id: string | null
          question_payload: Record<string, unknown>
          created_at: string
        }
        // Only ever written via game_create_session (SECURITY DEFINER).
        Insert: never
        Update: never
        Relationships: []
      }
      game_answers: {
        Row: {
          id: string
          game_question_id: string
          game_session_participant_id: string
          submitted_answer: Record<string, unknown> | null
          is_correct: boolean
          response_time_ms: number | null
          answered_at: string
        }
        // Only ever written via game_submit_answer (SECURITY DEFINER) --
        // grading always happens server-side, never trusting the client.
        Insert: never
        Update: never
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      lookup_class_by_code: {
        Args: { p_class_code: string }
        Returns: LookupClassResult | null
      }
      join_class: {
        Args: { p_class_student_id: string }
        Returns: JoinClassResult
      }
      get_my_student_session: {
        Args: Record<PropertyKey, never>
        Returns: StudentSessionResult | null
      }
      contribute_word: {
        Args: {
          p_word: string
          p_translation?: string | null
          p_word_type?: string | null
          p_gender?: string | null
          p_plural?: string | null
          p_translation_source?: string
          p_lexical_source?: string
          p_enrichment_status?: string
        }
        Returns: ContributeWordResult
      }
      game_create_session: {
        Args: {
          p_class_id: string
          p_game_type: GameType
          p_word_set_filter: WordSetFilter
          p_settings?: Record<string, unknown>
        }
        Returns: GameCreateSessionResult
      }
      game_start_session: {
        Args: { p_session_id: string }
        Returns: GameStartSessionResult
      }
      game_advance_question: {
        Args: { p_session_id: string }
        Returns: GameAdvanceQuestionResult
      }
      game_submit_answer: {
        Args: {
          p_game_question_id: string
          p_participant_id: string
          p_submitted_answer: Record<string, unknown>
          p_response_time_ms?: number | null
        }
        Returns: GameSubmitAnswerResult
      }
      game_end_session: {
        Args: { p_session_id: string }
        Returns: GameEndSessionResult
      }
      class_word_stats: {
        Args: { p_class_id: string; p_limit?: number }
        Returns: ClassWordStat[]
      }
      class_student_stats: {
        Args: { p_class_id: string }
        Returns: ClassStudentStat[]
      }
      teacher_dashboard_stats: {
        Args: Record<PropertyKey, never>
        Returns: TeacherDashboardStats
      }
      student_dashboard_stats: {
        Args: Record<PropertyKey, never>
        Returns: StudentDashboardStats
      }
    }
  }
}
