/**
 * Hand-written Supabase database types, covering the tables that exist so
 * far (M2: languages, teachers, classes). Replace/extend this by running
 * `supabase gen types typescript --project-id <ref> > src/lib/supabase/types.ts`
 * once a real Supabase project exists -- keep the shape (Database ->
 * public -> Tables -> <table> -> Row/Insert/Update) so `createClient<Database>()`
 * elsewhere doesn't need to change.
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
          class_code: string
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
      }
    }
  }
}
