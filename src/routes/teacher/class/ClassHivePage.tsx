import { useMemo, useState } from "react"
import { useParams } from "react-router-dom"
import { ImageUp, Plus, Search, Sparkles } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useClassQuery } from "@/features/classes/useClasses"
import { useCreateHiveWordMutation, useHiveWordsQuery } from "@/features/hive/useHiveWords"
import { HiveWordFormDialog } from "@/features/hive/components/HiveWordFormDialog"
import { HiveWordsTable } from "@/features/hive/components/HiveWordsTable"
import { OcrImportDialog } from "@/features/hive/components/OcrImportDialog"

const ALL_TOPICS = "__all__"

export default function ClassHivePage() {
  const { classId } = useParams<{ classId: string }>()
  const { data: classItem } = useClassQuery(classId)
  const { data: words, isLoading } = useHiveWordsQuery(classId)
  const createWord = useCreateHiveWordMutation(classId ?? "")

  const [search, setSearch] = useState("")
  const [topic, setTopic] = useState(ALL_TOPICS)
  const [addOpen, setAddOpen] = useState(false)

  const topics = useMemo(
    () => [...new Set((words ?? []).map((w) => w.topic).filter((t): t is string => Boolean(t)))].sort(),
    [words],
  )

  const filteredWords = useMemo(() => {
    if (!words) return []
    const query = search.trim().toLowerCase()
    return words.filter((w) => {
      const matchesTopic = topic === ALL_TOPICS || w.topic === topic
      const matchesSearch =
        !query ||
        w.word.toLowerCase().includes(query) ||
        (w.translation ?? "").toLowerCase().includes(query)
      return matchesTopic && matchesSearch
    })
  }, [words, search, topic])

  const existingWordsLower = useMemo(
    () => new Set((words ?? []).map((w) => w.word.toLowerCase())),
    [words],
  )

  if (!classId) return null

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold">The Hive</h2>
          <p className="text-sm text-muted-foreground">
            Every word this class has collected. Everything here is editable.
          </p>
        </div>
        <div className="flex gap-2">
          {classItem && (
            <OcrImportDialog
              classId={classId}
              learningLanguageCode={classItem.learning_language.code}
              deeplSourceCode={classItem.learning_language.deepl_source_code}
              deeplTargetCode={classItem.display_language.deepl_target_code}
              existingWordsLower={existingWordsLower}
              trigger={
                <Button size="sm" variant="outline">
                  <ImageUp className="size-4" />
                  Import from photo
                </Button>
              }
            />
          )}
          <HiveWordFormDialog
            open={addOpen}
            onOpenChange={setAddOpen}
            trigger={
              <Button size="sm">
                <Plus className="size-4" />
                Add word
              </Button>
            }
            title="Add a word"
            description="Type the word and look it up, or fill everything in yourself."
            submitLabel="Add to Hive"
            enrichment={
              classItem
                ? {
                    learningLanguageCode: classItem.learning_language.code,
                    deeplSourceCode: classItem.learning_language.deepl_source_code,
                    deeplTargetCode: classItem.display_language.deepl_target_code,
                  }
                : undefined
            }
            onSubmit={async (values) => {
              try {
                await createWord.mutateAsync({ classId, ...values })
                toast.success(`"${values.word}" added to the Hive`)
              } catch (error) {
                // Postgres unique_violation (hive_words_class_word_unique) --
                // check the error code, not the message text: Supabase's
                // PostgrestError doesn't always survive an `instanceof Error`
                // check once it's passed through TanStack Query's mutation
                // pipeline, but `code` is a plain, reliable string field.
                const code = (error as { code?: string } | null)?.code
                const message = error instanceof Error ? error.message : undefined
                const isDuplicate = code === "23505"
                toast.error(isDuplicate ? "That word is already in the Hive" : "Couldn't add word", {
                  description: isDuplicate ? undefined : message,
                })
                throw error
              }
            }}
          />
        </div>
      </div>

      {!isLoading && words && words.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search words or translations"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          {topics.length > 0 && (
            <Select value={topic} onValueChange={setTopic}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All topics" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_TOPICS}>All topics</SelectItem>
                {topics.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}

      {isLoading && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10" />
          ))}
        </div>
      )}

      {!isLoading && words && words.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center">
          <Sparkles className="size-8 text-muted-foreground" />
          <div>
            <p className="font-medium">The Hive is empty</p>
            <p className="text-sm text-muted-foreground">
              Add your first word to start building this class's vocabulary.
            </p>
          </div>
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="size-4" />
            Add word
          </Button>
        </div>
      )}

      {!isLoading && filteredWords.length > 0 && (
        <HiveWordsTable classId={classId} words={filteredWords} />
      )}

      {!isLoading && words && words.length > 0 && filteredWords.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No words match your search.
        </p>
      )}
    </div>
  )
}
