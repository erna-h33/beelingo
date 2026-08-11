import { z } from "zod"

export const authFormSchema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
})

export type AuthFormValues = z.infer<typeof authFormSchema>

export const updateProfileSchema = z.object({
  displayName: z.string().trim().max(80, "Keep it under 80 characters").optional(),
  email: z.string().min(1, "Email is required").email("Enter a valid email address"),
})

export type UpdateProfileValues = z.infer<typeof updateProfileSchema>

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Confirm your new password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  })

export type ChangePasswordValues = z.infer<typeof changePasswordSchema>
