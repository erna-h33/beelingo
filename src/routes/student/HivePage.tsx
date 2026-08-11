import { useMemo, useState } from "react"
import { Hexagon, Plus, Quote, Sparkles, StickyNote } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useStudentSessionQuery } from "@/features/studentSession/useStudentSession"
import { useHiveWordsQuery } from "@/features/hive/useHiveWords"
import { useMyContributionsQuery } from "@/features/hive/useContributions"
import { ContributeWordDialog } from "@/features/hive/components/ContributeWordDialog"
import { HiveSearchInput } from "@/features/hive/components/HiveSearchInput"
import { MyContributionRow } from "@/features/hive/components/MyContributionRow"
import { AudioPlayButton } from "@/features/hive/audio/AudioPlayButton"

export default function HivePage() {
  const { data: session } = useStudentSessionQuery()
  const { data: words, isLoading: wordsLoading } = useHiveWordsQuery(session?.classId)
  const { data: contributions, isLoading: contributionsLoading } = useMyContributionsQuery(
    session?.classStudentId,
  )
  // Independent per tab -- searching the whole Hive and searching just
  // your own contributions are different intents over different lists,
  // so switching tabs doesn't carry one search into the other.
  const [hiveSearch, setHiveSearch] = useState("")
  const [mineSearch, setMineSearch] = useState("")

  const filteredWords = useMemo(() => {
    if (!words) return []
    const query = hiveSearch.trim().toLowerCase()
    const matches = query
      ? words.filter(
          (w) =>
            w.word.toLowerCase().includes(query) ||
            (w.translation ?? "").toLowerCase().includes(query),
        )
      : words
    return [...matches].sort((a, b) => a.word.localeCompare(b.word))
  }, [words, hiveSearch])

  const filteredContributions = useMemo(() => {
    if (!contributions) return []
    const query = mineSearch.trim().toLowerCase()
    if (!query) return contributions
    return contributions.filter(
      (c) => c.word.toLowerCase().includes(query) || (c.translation ?? "").toLowerCase().includes(query),
    )
  }, [contributions, mineSearch])

  if (!session) return null

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">The Hive</h1>
          <p className="text-sm text-muted-foreground">{session.className}</p>
        </div>
        <ContributeWordDialog
          session={session}
          existingWords={words ?? []}
          trigger={
            <Button size="sm">
              <Plus className="size-4" />
              Contribute
            </Button>
          }
        />
      </div>

      <Tabs defaultValue="hive">
        <TabsList className="w-full">
          <TabsTrigger value="hive" className="flex-1">
            Whole Hive
          </TabsTrigger>
          <TabsTrigger value="mine" className="flex-1">
            My Contributions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="hive" className="flex flex-col gap-3 pt-3">
          {!wordsLoading && words && words.length > 0 && (
            <HiveSearchInput value={hiveSearch} onChange={setHiveSearch} sticky />
          )}

          {wordsLoading && (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-14" />
              ))}
            </div>
          )}

          {!wordsLoading && words && words.length === 0 && (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-12 text-center">
              <Hexagon className="size-8 text-muted-foreground" />
              <p className="font-medium">The Hive is empty</p>
              <p className="text-sm text-muted-foreground">Be the first to contribute a word!</p>
            </div>
          )}

          {!wordsLoading &&
            filteredWords.map((word) => (
              <div key={word.id} className="rounded-lg border border-border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{word.word}</p>
                    {word.translation && (
                      <p className="text-sm text-muted-foreground">{word.translation}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <AudioPlayButton path={word.teacher_audio_path} />
                    {word.topic && <Badge variant="outline">{word.topic}</Badge>}
                  </div>
                </div>
                {(word.word_type || word.gender || word.plural) && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {[word.word_type, word.gender, word.plural && `pl. ${word.plural}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                )}
                {word.practice_sentence && (
                  <p className="mt-2 flex items-start gap-1.5 text-sm text-muted-foreground italic">
                    <Quote className="mt-0.5 size-3.5 shrink-0" />
                    {word.practice_sentence}
                  </p>
                )}
                {word.teacher_notes && (
                  <p className="mt-2 flex items-start gap-1.5 rounded-md bg-muted px-2 py-1.5 text-xs text-muted-foreground">
                    <StickyNote className="mt-0.5 size-3.5 shrink-0" />
                    {word.teacher_notes}
                  </p>
                )}
              </div>
            ))}

          {!wordsLoading && words && words.length > 0 && filteredWords.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">No words match your search.</p>
          )}
        </TabsContent>

        <TabsContent value="mine" className="flex flex-col gap-3 pt-3">
          {!contributionsLoading && contributions && contributions.length > 0 && (
            <HiveSearchInput value={mineSearch} onChange={setMineSearch} sticky />
          )}

          {contributionsLoading && (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          )}

          {!contributionsLoading && contributions && contributions.length === 0 && (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-12 text-center">
              <Sparkles className="size-8 text-muted-foreground" />
              <p className="font-medium">No contributions yet</p>
              <p className="text-sm text-muted-foreground">
                Tap "Contribute" to add a word you learned.
              </p>
            </div>
          )}

          <div className="flex flex-col gap-2">
            {!contributionsLoading &&
              filteredContributions.map((contribution) => (
                <MyContributionRow
                  key={contribution.id}
                  contribution={contribution}
                  classStudentId={session.classStudentId}
                  classId={session.classId}
                />
              ))}
          </div>

          {!contributionsLoading && contributions && contributions.length > 0 && filteredContributions.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">No contributions match your search.</p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
