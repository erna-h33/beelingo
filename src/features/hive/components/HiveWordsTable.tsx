import { useMemo, useState } from "react"
import { ArrowDown, ArrowUp, ArrowUpDown, CheckCircle2, Circle, Mic, Pencil, Trash2 } from "lucide-react"
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

/** What the Source badge actually shows -- the contributing student's
 * name when resolvable, otherwise the generic source label. Shared by
 * the row's badge and the Source column's sort comparator so they never
 * disagree on what "the source" of a word is. */
function sourceLabelFor(word: HiveWord, studentNamesById: Record<string, string>): string {
  const contributorName =
    word.source === "student" && word.added_by_class_student_id
      ? studentNamesById[word.added_by_class_student_id]
      : undefined
  return contributorName ?? SOURCE_LABEL[word.source]
}

type SortColumn = "word" | "topic" | "source" | "verified"
type SortDirection = "asc" | "desc"

function compareWords(
  a: HiveWord,
  b: HiveWord,
  column: SortColumn,
  studentNamesById: Record<string, string>,
): number {
  switch (column) {
    case "word":
      return a.word.localeCompare(b.word)
    case "topic": {
      // Words without a topic always sort to the bottom, regardless of
      // direction -- flipping "no topic" to the top on descending would
      // just be confusing to scan.
      if (!a.topic && !b.topic) return 0
      if (!a.topic) return 1
      if (!b.topic) return -1
      return a.topic.localeCompare(b.topic)
    }
    case "source":
      return sourceLabelFor(a, studentNamesById).localeCompare(sourceLabelFor(b, studentNamesById))
    case "verified":
      return Number(a.verified) - Number(b.verified)
  }
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
  const [sortColumn, setSortColumn] = useState<SortColumn>("word")
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")

  function handleSort(column: SortColumn) {
    if (column === sortColumn) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortColumn(column)
      setSortDirection("asc")
    }
  }

  const sortedWords = useMemo(() => {
    const sign = sortDirection === "asc" ? 1 : -1
    return [...words].sort((a, b) => sign * compareWords(a, b, sortColumn, studentNamesById))
  }, [words, sortColumn, sortDirection, studentNamesById])

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <SortableHead column="word" label="Word" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
          <TableHead>Translation</TableHead>
          <TableHead>Details</TableHead>
          <SortableHead column="topic" label="Topic" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
          <SortableHead column="source" label="Source" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
          <SortableHead column="verified" label="Verified" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sortedWords.map((word) => (
          <HiveWordRow key={word.id} classId={classId} word={word} studentNamesById={studentNamesById} />
        ))}
      </TableBody>
    </Table>
  )
}

function SortableHead({
  column,
  label,
  sortColumn,
  sortDirection,
  onSort,
}: {
  column: SortColumn
  label: string
  sortColumn: SortColumn
  sortDirection: SortDirection
  onSort: (column: SortColumn) => void
}) {
  const isActive = sortColumn === column
  const Icon = isActive ? (sortDirection === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown
  return (
    <TableHead>
      <button
        type="button"
        onClick={() => onSort(column)}
        className={cn(
          "flex items-center gap-1 text-sm font-medium",
          isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground",
        )}
        aria-label={`Sort by ${label}${isActive ? `, currently ${sortDirection === "asc" ? "ascending" : "descending"}` : ""}`}
      >
        {label}
        <Icon className="size-3.5" />
      </button>
    </TableHead>
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

  const sourceLabel = sourceLabelFor(word, studentNamesById)

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
