import { useState } from "react"
import { CheckCircle2, Circle, Mic, Pencil, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
import { cn } from "@/lib/utils"
import {
  useDeleteHiveWordMutation,
  useSetVerifiedMutation,
  useUpdateHiveWordMutation,
  type HiveWord,
} from "@/features/hive/useHiveWords"
import { AudioRecorderDialog } from "@/features/hive/audio/AudioRecorderDialog"
import { HiveWordFormDialog } from "./HiveWordFormDialog"

const SOURCE_LABEL: Record<HiveWord["source"], string> = {
  teacher: "Teacher",
  student: "Student",
  ocr: "OCR",
}

interface HiveWordsTableProps {
  classId: string
  words: HiveWord[]
  /** Roster display names keyed by class_student_id, for resolving
   * hive_words.added_by_class_student_id -- "who actually contributed
   * this word," not just its generic source type. */
  studentNamesById: Record<string, string>
}

export function HiveWordsTable({ classId, words, studentNamesById }: HiveWordsTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Word</TableHead>
          <TableHead>Translation</TableHead>
          <TableHead>Details</TableHead>
          <TableHead>Topic</TableHead>
          <TableHead>Source</TableHead>
          <TableHead>Verified</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {words.map((word) => (
          <HiveWordRow key={word.id} classId={classId} word={word} studentNamesById={studentNamesById} />
        ))}
      </TableBody>
    </Table>
  )
}

function HiveWordRow({
  classId,
  word,
  studentNamesById,
}: {
  classId: string
  word: HiveWord
  studentNamesById: Record<string, string>
}) {
  const [editOpen, setEditOpen] = useState(false)
  const updateWord = useUpdateHiveWordMutation(classId)
  const setVerified = useSetVerifiedMutation(classId)
  const deleteWord = useDeleteHiveWordMutation(classId)

  const details = [word.word_type, word.gender, word.plural && `pl. ${word.plural}`]
    .filter(Boolean)
    .join(" · ")

  // Prefer the actual contributor's name over the generic source type --
  // falls back to "Student" if they've since been removed from the
  // roster (added_by_class_student_id set-nulls on delete) or the
  // roster hasn't loaded yet.
  const contributorName =
    word.source === "student" && word.added_by_class_student_id
      ? studentNamesById[word.added_by_class_student_id]
      : undefined
  const sourceLabel = contributorName ?? SOURCE_LABEL[word.source]

  async function handleToggleVerified() {
    try {
      await setVerified.mutateAsync({ id: word.id, verified: !word.verified })
    } catch (error) {
      toast.error("Couldn't update", {
        description: error instanceof Error ? error.message : undefined,
      })
    }
  }

  async function handleDelete() {
    try {
      await deleteWord.mutateAsync(word.id)
      toast.success(`"${word.word}" removed from the Hive`)
    } catch (error) {
      toast.error("Couldn't delete word", {
        description: error instanceof Error ? error.message : undefined,
      })
    }
  }

  return (
    <TableRow>
      <TableCell className="font-medium">{word.word}</TableCell>
      <TableCell className="text-muted-foreground">{word.translation || "—"}</TableCell>
      <TableCell className="text-sm text-muted-foreground">{details || "—"}</TableCell>
      <TableCell>{word.topic ? <Badge variant="outline">{word.topic}</Badge> : "—"}</TableCell>
      <TableCell>
        <Badge variant="secondary">{sourceLabel}</Badge>
      </TableCell>
      <TableCell>
        <button
          type="button"
          onClick={handleToggleVerified}
          className={cn(
            "flex items-center gap-1.5 text-sm",
            word.verified ? "text-success" : "text-muted-foreground",
          )}
          aria-label={word.verified ? "Mark unverified" : "Mark verified"}
        >
          {word.verified ? (
            <CheckCircle2 className="size-4" />
          ) : (
            <Circle className="size-4" />
          )}
          {word.verified ? "Verified" : "Unverified"}
        </button>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
          <AudioRecorderDialog
            classId={classId}
            hiveWordId={word.id}
            word={word.word}
            existingAudioPath={word.teacher_audio_path}
            trigger={
              <Button
                variant="ghost"
                size="icon"
                className={cn("size-8", word.teacher_audio_path && "text-primary")}
                aria-label={`Record audio for ${word.word}`}
              >
                <Mic className="size-4" />
              </Button>
            }
          />
          <HiveWordFormDialog
            open={editOpen}
            onOpenChange={setEditOpen}
            trigger={
              <Button variant="ghost" size="icon" className="size-8" aria-label={`Edit ${word.word}`}>
                <Pencil className="size-4" />
              </Button>
            }
            title="Edit word"
            description="Update any field -- everything here is always editable."
            submitLabel="Save changes"
            defaultValues={{
              word: word.word,
              translation: word.translation ?? undefined,
              wordType: word.word_type ?? undefined,
              gender: word.gender ?? undefined,
              plural: word.plural ?? undefined,
              topic: word.topic ?? undefined,
              practiceSentence: word.practice_sentence ?? undefined,
              teacherNotes: word.teacher_notes ?? undefined,
            }}
            onSubmit={async (values) => {
              try {
                await updateWord.mutateAsync({ id: word.id, ...values })
                toast.success("Word updated")
              } catch (error) {
                toast.error("Couldn't update word", {
                  description: error instanceof Error ? error.message : undefined,
                })
              }
            }}
          />
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground"
                aria-label={`Delete ${word.word}`}
              >
                <Trash2 className="size-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove "{word.word}" from the Hive?</AlertDialogTitle>
                <AlertDialogDescription>
                  This can't be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>Remove</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </TableCell>
    </TableRow>
  )
}
