import { z } from "zod"

export const hiveWordFormSchema = z.object({
  word: z.string().min(1, "Enter a word").max(120),
  translation: z.string().max(200).optional(),
  wordType: z.string().max(40).optional(),
  gender: z.string().max(40).optional(),
  plural: z.string().max(120).optional(),
  topic: z.string().max(60).optional(),
  practiceSentence: z.string().max(400).optional(),
  teacherNotes: z.string().max(400).optional(),
})

export type HiveWordFormValues = z.infer<typeof hiveWordFormSchema>
