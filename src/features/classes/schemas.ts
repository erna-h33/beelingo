import { z } from "zod"

export const classFormSchema = z.object({
  name: z.string().min(1, "Give the class a name").max(80, "Keep it under 80 characters"),
  learningLanguageId: z.string().min(1, "Pick the language your students are learning"),
  displayLanguageId: z.string().min(1, "Pick the language translations show in"),
})

export type ClassFormValues = z.infer<typeof classFormSchema>
