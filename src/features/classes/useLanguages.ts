import { useQuery } from "@tanstack/react-query"

import { supabase } from "@/lib/supabase/client"

/**
 * The 15-language seed list. Public read-only reference data (see
 * migrations/0002_languages.sql) -- cached aggressively since it never
 * changes during a session.
 */
export function useLanguagesQuery() {
  return useQuery({
    queryKey: ["languages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("languages")
        .select("id, code, name, native_name, flag_emoji")
        .order("name")
      if (error) throw error
      return data
    },
    staleTime: Infinity,
  })
}
