import { useMemo, useState } from "react"
import { CheckCircle2, Hexagon, Plus, Search, Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useStudentSessionQuery } from "@/features/studentSession/useStudentSession"
import { useHiveWordsQuery } from "@/features/hive/useHiveWords"
import { useMyContributionsQuery } from "@/features/hive/useContributions"
import { ContributeWordDialog } from "@/features/hive/components/ContributeWordDialog"

export default function HivePage() {
  const { data: session } = useStudentSessionQuery()
  const { data: words, isLoading: wordsLoading } = useHiveWordsQuery(session?.classId)
  const { data: contributions, isLoading: contributionsLoading } = useMyContributionsQuery(
    session?.classStudentId,
  )
  const [search, setSearch] = useState("")

  const filteredWords = useMemo(() => {
    if (!words) return []
    const query = search.trim().toLowerCase()
    if (!query) return words
    return words.filter(
      (w) =>
        w.word.toLowerCase().includes(query) || (w.translation ?? "").toLowerCase().includes(query),
    )
  }, [words, search])

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
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search words or translations"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
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
                  {word.topic && <Badge variant="outline">{word.topic}</Badge>}
                </div>
                {(word.word_type || word.gender || word.plural) && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {[word.word_type, word.gender, word.plural && `pl. ${word.plural}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                )}
              </div>
            ))}

          {!wordsLoading && words && words.length > 0 && filteredWords.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">No words match your search.</p>
          )}
        </TabsContent>

        <TabsContent value="mine" className="flex flex-col gap-2 pt-3">
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

          {!contributionsLoading &&
            contributions?.map((contribution) => (
              <div key={contribution.id} className="flex items-center gap-2 rounded-lg border border-border p-3">
                <CheckCircle2 className="size-4 shrink-0 text-success" />
                <div className="min-w-0">
                  <p className="font-medium">{contribution.word}</p>
                  {contribution.translation && (
                    <p className="truncate text-sm text-muted-foreground">{contribution.translation}</p>
                  )}
                </div>
              </div>
            ))}
        </TabsContent>
      </Tabs>
    </div>
  )
}
