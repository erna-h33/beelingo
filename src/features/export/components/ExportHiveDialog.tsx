import { useMemo, useState, type ReactNode } from "react"
import { Download } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { HiveWord } from "@/features/hive/useHiveWords"

import { exportHiveWords, filterHiveWordsForExport, type HiveExportFilter } from "../exportHive"

const FILTER_LABEL: Record<HiveExportFilter, string> = {
  entire_hive: "Entire Hive",
  today: "Added today",
  this_week: "Added this week",
  by_topic: "By topic",
}

interface ExportHiveDialogProps {
  trigger: ReactNode
  className: string
  words: HiveWord[]
}

export function ExportHiveDialog({ trigger, className, words }: ExportHiveDialogProps) {
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState<HiveExportFilter>("entire_hive")
  const [topic, setTopic] = useState("")

  const topics = useMemo(
    () => [...new Set(words.map((w) => w.topic).filter((t): t is string => Boolean(t)))].sort(),
    [words],
  )

  const preview = useMemo(
    () => filterHiveWordsForExport(words, filter, topic),
    [words, filter, topic],
  )

  const canExport = filter !== "by_topic" || Boolean(topic)

  function handleExport() {
    exportHiveWords(className, preview)
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export the Hive</DialogTitle>
          <DialogDescription>Download a CSV -- opens in Excel, Sheets, or any flashcard tool.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>Which words</Label>
            <Select value={filter} onValueChange={(v) => setFilter(v as HiveExportFilter)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(FILTER_LABEL) as HiveExportFilter[]).map((f) => (
                  <SelectItem key={f} value={f}>
                    {FILTER_LABEL[f]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {filter === "by_topic" && (
            <div className="flex flex-col gap-2">
              <Label>Topic</Label>
              <Select value={topic} onValueChange={setTopic}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a topic" />
                </SelectTrigger>
                <SelectContent>
                  {topics.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {topics.length === 0 && (
                <p className="text-xs text-muted-foreground">No topics tagged in the Hive yet.</p>
              )}
            </div>
          )}

          <p className="text-sm text-muted-foreground">
            {preview.length} word{preview.length === 1 ? "" : "s"} will be included.
          </p>
        </div>

        <DialogFooter>
          <Button onClick={handleExport} disabled={!canExport || preview.length === 0}>
            <Download className="size-4" />
            Download CSV
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
