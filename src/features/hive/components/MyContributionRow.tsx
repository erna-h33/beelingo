import { useState } from "react"
import { CheckCircle2, Loader2, Pencil, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { HiveWordFormDialog } from "@/features/hive/components/HiveWordFormDialog"
import {
  useDeleteMyWordMutation,
  useUpdateMyWordMutation,
  type MyContribution,
} from "@/features/hive/useContributions"

interface MyContributionRowProps {
  contribution: MyContribution
  classStudentId: string
  classId: string
}

/**
 * One row in the student's "My Contributions" list. Edit/delete
 * controls only ever appear for words this student actually created
 * (isFirstContribution) -- reinforcing an existing word never grants
 * any rights over it. Even then, the mutations can still be rejected by
 * RLS (another student contributed to it since the page loaded) --
 * that's surfaced as a normal error toast, not pre-checked here.
 */
export function MyContributionRow({ contribution, classStudentId, classId }: MyContributionRowProps) {
  const [editOpen, setEditOpen] = useState(false)
  const updateWord = useUpdateMyWordMutation(classStudentId, classId)
  const deleteWord = useDeleteMyWordMutation(classStudentId, classId)
  const canManage = contribution.isFirstContribution

  async function handleDelete() {
    try {
      await deleteWord.mutateAsync(contribution.hiveWordId)
      toast.success(`"${contribution.word}" removed from the Hive`)
    } catch (error) {
      toast.error("Couldn't delete word", {
        description: error instanceof Error ? error.message : undefined,
      })
    }
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border p-3">
      <CheckCircle2 className="size-4 shrink-0 text-success" />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{contribution.word}</p>
        {contribution.translation && (
          <p className="truncate text-sm text-muted-foreground">{contribution.translation}</p>
        )}
      </div>
      {canManage && (
        <div className="flex shrink-0 items-center gap-1">
          <HiveWordFormDialog
            open={editOpen}
            onOpenChange={setEditOpen}
            hideTeacherNotes
            trigger={
              <Button variant="ghost" size="icon" className="size-8" aria-label={`Edit ${contribution.word}`}>
                <Pencil className="size-4" />
              </Button>
            }
            title="Edit your word"
            description="Update any field -- you can only edit words you added that no one else has added to yet."
            submitLabel="Save changes"
            defaultValues={{
              word: contribution.word,
              translation: contribution.translation ?? undefined,
              wordType: contribution.wordType ?? undefined,
              gender: contribution.gender ?? undefined,
              plural: contribution.plural ?? undefined,
              topic: contribution.topic ?? undefined,
              practiceSentence: contribution.practiceSentence ?? undefined,
            }}
            onSubmit={async (values) => {
              try {
                await updateWord.mutateAsync({ hiveWordId: contribution.hiveWordId, ...values })
                toast.success("Word updated")
              } catch (error) {
                toast.error("Couldn't update word", {
                  description: error instanceof Error ? error.message : undefined,
                })
                throw error
              }
            }}
          />
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground"
                aria-label={`Delete ${contribution.word}`}
                disabled={deleteWord.isPending}
              >
                {deleteWord.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Trash2 className="size-4" />
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove "{contribution.word}" from the Hive?</AlertDialogTitle>
                <AlertDialogDescription>This can't be undone.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>Remove</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </div>
  )
}
