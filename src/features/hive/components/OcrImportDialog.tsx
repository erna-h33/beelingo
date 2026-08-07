import { useRef, useState, type ReactNode } from "react"
import {
  CheckCircle2,
  ImageUp,
  Loader2,
  ScanText,
  XCircle,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { extractTextFromImage, textToCandidateWords } from "@/features/hive/ocr/extractWords"
import { TESSERACT_LANGUAGE_CODE } from "@/features/hive/ocr/tesseractLanguages"
import { importWordsFromOcr, type BatchImportResult } from "@/features/hive/ocr/importWords"
import { useInvalidateHive } from "@/features/hive/useHiveWords"

interface OcrImportDialogProps {
  trigger: ReactNode
  classId: string
  learningLanguageCode: string
  deeplSourceCode: string | null
  deeplTargetCode: string | null
  existingWordsLower: Set<string>
}

type Step = "upload" | "processing" | "review" | "importing" | "summary"

interface Candidate {
  text: string
  selected: boolean
  alreadyInHive: boolean
}

export function OcrImportDialog({
  trigger,
  classId,
  learningLanguageCode,
  deeplSourceCode,
  deeplTargetCode,
  existingWordsLower,
}: OcrImportDialogProps) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>("upload")
  const [ocrProgress, setOcrProgress] = useState(0)
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [importProgress, setImportProgress] = useState({ completed: 0, total: 0 })
  const [results, setResults] = useState<BatchImportResult[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const invalidateHive = useInvalidateHive(classId)

  function reset() {
    setStep("upload")
    setOcrProgress(0)
    setCandidates([])
    setImportProgress({ completed: 0, total: 0 })
    setResults([])
  }

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) reset()
  }

  async function handleFileSelected(file: File) {
    setStep("processing")
    setOcrProgress(0)
    const tesseractLang = TESSERACT_LANGUAGE_CODE[learningLanguageCode] ?? "eng"
    try {
      const text = await extractTextFromImage(file, tesseractLang, setOcrProgress)
      const words = textToCandidateWords(text)
      setCandidates(
        words.map((word) => ({
          text: word,
          selected: !existingWordsLower.has(word.toLowerCase()),
          alreadyInHive: existingWordsLower.has(word.toLowerCase()),
        })),
      )
      setStep("review")
    } catch {
      setCandidates([])
      setStep("review")
    }
  }

  async function handleImport() {
    const selected = candidates.filter((c) => c.selected && c.text.trim()).map((c) => c.text.trim())
    if (selected.length === 0) return
    setStep("importing")
    setImportProgress({ completed: 0, total: selected.length })
    const importResults = await importWordsFromOcr(
      selected,
      { classId, learningLanguageCode, deeplSourceCode, deeplTargetCode },
      (completed, total) => setImportProgress({ completed, total }),
    )
    setResults(importResults)
    invalidateHive()
    setStep("summary")
  }

  const selectedCount = candidates.filter((c) => c.selected).length
  const createdCount = results.filter((r) => r.status === "created").length
  const duplicateCount = results.filter((r) => r.status === "duplicate").length
  const failedCount = results.filter((r) => r.status === "failed").length

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import from a photo</DialogTitle>
          <DialogDescription>
            Upload a photo of a vocabulary list. OCR pulls out candidate words for you to review
            before anything is added -- misreads are normal, just fix or uncheck them.
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed py-10">
            <ImageUp className="size-8 text-muted-foreground" />
            <div className="text-center">
              <p className="font-medium">Choose a photo</p>
              <p className="text-sm text-muted-foreground">A clear, well-lit shot works best.</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void handleFileSelected(file)
              }}
            />
            <Button onClick={() => fileInputRef.current?.click()}>
              <ImageUp className="size-4" />
              Choose photo
            </Button>
          </div>
        )}

        {step === "processing" && (
          <div className="flex flex-col items-center gap-4 py-10">
            <ScanText className="size-8 animate-pulse text-primary" />
            <p className="font-medium">Reading the photo…</p>
            <div className="h-2 w-full max-w-xs overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${Math.round(ocrProgress * 100)}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">{Math.round(ocrProgress * 100)}%</p>
          </div>
        )}

        {step === "review" && (
          <div className="flex flex-col gap-3">
            {candidates.length === 0 ? (
              <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
                No text found in that photo. Try a clearer or better-lit shot.
              </p>
            ) : (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {candidates.length} found · {selectedCount} selected
                  </span>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      className="text-primary hover:underline"
                      onClick={() =>
                        setCandidates((cs) => cs.map((c) => ({ ...c, selected: true })))
                      }
                    >
                      Select all
                    </button>
                    <button
                      type="button"
                      className="text-primary hover:underline"
                      onClick={() =>
                        setCandidates((cs) => cs.map((c) => ({ ...c, selected: false })))
                      }
                    >
                      Select none
                    </button>
                  </div>
                </div>
                <div className="flex max-h-80 flex-col gap-1.5 overflow-y-auto">
                  {candidates.map((candidate, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Checkbox
                        checked={candidate.selected}
                        onCheckedChange={(checked) =>
                          setCandidates((cs) =>
                            cs.map((c, i) => (i === index ? { ...c, selected: Boolean(checked) } : c)),
                          )
                        }
                      />
                      <Input
                        value={candidate.text}
                        onChange={(e) =>
                          setCandidates((cs) =>
                            cs.map((c, i) => (i === index ? { ...c, text: e.target.value } : c)),
                          )
                        }
                        className="h-8"
                      />
                      {candidate.alreadyInHive && (
                        <span className="shrink-0 text-xs text-muted-foreground">Already in Hive</span>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
            <DialogFooter>
              <Button onClick={handleImport} disabled={selectedCount === 0}>
                Import {selectedCount > 0 ? selectedCount : ""} {selectedCount === 1 ? "word" : "words"}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "importing" && (
          <div className="flex flex-col items-center gap-4 py-10">
            <Loader2 className="size-8 animate-spin text-primary" />
            <p className="font-medium">
              Adding word {importProgress.completed} of {importProgress.total}…
            </p>
            <div className="h-2 w-full max-w-xs overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{
                  width: `${importProgress.total ? Math.round((importProgress.completed / importProgress.total) * 100) : 0}%`,
                }}
              />
            </div>
          </div>
        )}

        {step === "summary" && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-lg bg-success/10 p-3">
                <p className="text-2xl font-semibold text-success">{createdCount}</p>
                <p className="text-xs text-muted-foreground">Added</p>
              </div>
              <div className="rounded-lg bg-muted p-3">
                <p className="text-2xl font-semibold">{duplicateCount}</p>
                <p className="text-xs text-muted-foreground">Already existed</p>
              </div>
              <div className={cn("rounded-lg p-3", failedCount > 0 ? "bg-destructive/10" : "bg-muted")}>
                <p
                  className={cn(
                    "text-2xl font-semibold",
                    failedCount > 0 ? "text-destructive" : undefined,
                  )}
                >
                  {failedCount}
                </p>
                <p className="text-xs text-muted-foreground">Failed</p>
              </div>
            </div>
            <div className="flex max-h-56 flex-col gap-1 overflow-y-auto text-sm">
              {results.map((result, index) => (
                <div key={index} className="flex items-center gap-2">
                  {result.status === "created" && <CheckCircle2 className="size-4 text-success" />}
                  {result.status === "duplicate" && (
                    <CheckCircle2 className="size-4 text-muted-foreground" />
                  )}
                  {result.status === "failed" && <XCircle className="size-4 text-destructive" />}
                  <span>{result.word}</span>
                  {result.status === "duplicate" && (
                    <span className="text-xs text-muted-foreground">already in Hive</span>
                  )}
                  {result.status === "failed" && (
                    <span className="text-xs text-destructive">{result.errorMessage ?? "failed"}</span>
                  )}
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button onClick={() => handleOpenChange(false)}>Done</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
