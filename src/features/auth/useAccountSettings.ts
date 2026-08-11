import { useMutation } from "@tanstack/react-query"

import { supabase } from "@/lib/supabase/client"
import type { ChangePasswordValues, UpdateProfileValues } from "./schemas"

/**
 * Display name + email, both written via `supabase.auth.updateUser` --
 * that's what the session object the rest of the app reads from
 * (DashboardPage's greeting, TeacherShell's avatar) reflects
 * immediately. `public.teachers.email`/`display_name` are populated
 * once at signup by a trigger and deliberately not client-writable
 * (see the `Update` type on that table) since nothing in the app reads
 * them back out -- the auth session is the single source of truth for
 * teacher identity, so there's nothing else here to keep in sync.
 *
 * Email changes may or may not apply immediately depending on the
 * project's Supabase Auth "secure email change" setting -- if
 * `updateUser` returns a user whose email hasn't actually flipped yet,
 * that means confirmation links were sent instead, so the caller needs
 * to branch on the result rather than assuming success.
 */
export function useUpdateProfileMutation() {
  return useMutation({
    mutationFn: async ({ displayName, email }: UpdateProfileValues) => {
      const { data, error } = await supabase.auth.updateUser({
        email,
        data: { display_name: displayName || null },
      })
      if (error) throw error

      return { emailChangedImmediately: data.user?.email === email }
    },
  })
}

/**
 * Re-authenticates with the current password first (protects against a
 * left-open session on a shared classroom computer silently having its
 * password swapped out), then applies the new one.
 */
export function useChangePasswordMutation() {
  return useMutation({
    mutationFn: async ({ currentPassword, newPassword }: ChangePasswordValues) => {
      const { data: userData, error: getUserError } = await supabase.auth.getUser()
      if (getUserError || !userData.user?.email) {
        throw new Error("Couldn't verify your account. Try logging in again.")
      }

      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email: userData.user.email,
        password: currentPassword,
      })
      if (reauthError) {
        throw new Error("Current password is incorrect")
      }

      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
    },
  })
}
