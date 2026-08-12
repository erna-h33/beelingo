import { CheckCircle2, Circle } from "lucide-react"
import { toast } from "sonner"

import { useToggleLearnedWordMutation } from "@/features/hive/useLearnedWords"

interface LearnedCheckboxProps {
  classStudentId: string
  hiveWordId: string
  learned: boolean
}

/** The student's personal "I've learned this word" checkbox on a Whole
 * Hive card. Writes to a private, per-student table (migration 0035)
 * that nothing else in the app reads -- purely a self-check, no effect
 * on games, mastery, or the teacher's view. */
export function LearnedCheckbox({ classStudentId, hiveWordId, learned }: LearnedCheckboxProps) {
  const toggleLearned = useToggleLearnedWordMutation(classStudentId)

  async function handleToggle() {
    try {
      await toggleLearned.mutateAsync({ hiveWordId, learned: !learned })
    } catch (error) {
      toast.error("Couldn't update", {
        description: error instanceof Error ? error.message : undefined,
      })
    }
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={toggleLearned.isPending}
      className="mt-0.5 shrink-0 disabled:opacity-50"
      aria-label={learned ? "Mark as not learned yet" : "Mark as learned"}
      aria-pressed={learned}
    >
      {learned ? (
        <CheckCircle2 className="size-5 text-success" />
      ) : (
        <Circle className="size-5 text-muted-foreground" />
      )}
    </button>
  )
}
