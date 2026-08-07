/**
 * Hand-written Supabase database types, covering the tables that exist so
 * far (M2: languages, teachers, classes; M3: class_students). Replace/
 * extend this by running `supabase gen types typescript --db-url ...`
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
    }
    Views: Record<string, never>
    Functions: Record<string, never>
  }
}
