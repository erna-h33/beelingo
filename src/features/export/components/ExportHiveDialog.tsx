import { useMemo, useState, type ReactNode } from "react"
import { Download } from "lucide-react"
import { toast } from "sonner"

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
import { cn } from "@/lib/utils"
import type { HiveWord } from "@/features/hive/useHiveWords"

import { exportHiveWords, exportHiveWordsPdf, filterHiveWordsForExport, type HiveExportFilter } from "../exportHive"

const FILTER_LABEL: Record<HiveExportFilter, string> = {
  entire_hive: "Entire Hive",
  today: "Added today",
  this_week: "Added this week",
  by_topic: "By topic",
}

type ExportFormat = "csv" | "pdf"

interface ExportHiveDialogProps {
  trigger: ReactNode
  className: string
  words: HiveWord[]
}

export function ExportHiveDialog({ trigger, className, words }: ExportHiveDialogProps) {
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState<HiveExportFilter>("entire_hive")
  const [topic, setTopic] = useState("")
  const [format, setFormat] = useState<ExportFormat>("csv")
  const [isExporting, setIsExporting] = useState(false)

  const topics = useMemo(
    () => [...new Set(words.map((w) => w.topic).filter((t): t is string => Boolean(t)))].sort(),
    [words],
  )

  const preview = useMemo(
    () => filterHiveWordsForExport(words, filter, topic),
    [words, filter, topic],
  )

  const canExport = filter !== "by_topic" || Boolean(topic)

  async function handleExport() {
    if (format === "csv") {
      exportHiveWords(className, preview)
      setOpen(false)
      return
    }
    // PDF generation is async -- jspdf/jspdf-autotable are dynamically
    // imported on first use (see pdf.ts), so this can take a beat
    // longer than the instant CSV path.
    setIsExporting(true)
    try {
      await exportHiveWordsPdf(className, preview)
      setOpen(false)
    } catch (error) {
      toast.error("Couldn't generate the PDF", {
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export the Hive</DialogTitle>
          <DialogDescription>
            CSV opens in Excel, Sheets, or any flashcard tool. PDF is ready to print or share as-is.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>Format</Label>
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
              {(["csv", "pdf"] as ExportFormat[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFormat(f)}
                  className={cn(
                    "rounded-md py-1.5 text-sm font-medium uppercase transition-colors",
                    format === f ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

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
          <Button onClick={handleExport} disabled={!canExport || preview.length === 0 || isExporting}>
            <Download className="size-4" />
            {isExporting ? "Generating…" : `Download ${format.toUpperCase()}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
