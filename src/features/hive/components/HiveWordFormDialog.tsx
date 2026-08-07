import { useEffect, type ReactNode } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { Languages, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { hiveWordFormSchema, type HiveWordFormValues } from "@/features/hive/schemas"
import { GENDER_OPTIONS, WORD_TYPE_OPTIONS } from "@/features/hive/constants"
import { useEnrichWordMutation } from "@/features/hive/useEnrichWord"

interface HiveWordFormDialogProps {
  trigger: ReactNode
  title: string
  description: string
  submitLabel: string
  defaultValues?: HiveWordFormValues
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onSubmit: (values: HiveWordFormValues) => Promise<void>
  /** Enables the "Look up" (DeepL + Wikidata) button. Omit when editing
   * an existing word -- lookup is only offered at creation time. */
  enrichment?: {
    learningLanguageCode: string
    deeplSourceCode: string | null
    deeplTargetCode: string | null
  }
}

const EMPTY_DEFAULTS: HiveWordFormValues = { word: "" }

export function HiveWordFormDialog({
  trigger,
  title,
  description,
  submitLabel,
  defaultValues,
  open,
  onOpenChange,
  onSubmit,
  enrichment,
}: HiveWordFormDialogProps) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<HiveWordFormValues>({
    resolver: zodResolver(hiveWordFormSchema),
    defaultValues: defaultValues ?? EMPTY_DEFAULTS,
  })
  const enrichWord = useEnrichWordMutation()

  useEffect(() => {
    if (open) reset(defaultValues ?? EMPTY_DEFAULTS)
  }, [open, defaultValues, reset])

  const wordType = watch("wordType")
  const gender = watch("gender")

  async function handleLookup() {
    const word = getValues("word").trim()
    if (!word || !enrichment) return
    try {
      const result = await enrichWord.mutateAsync({
        word,
        learningLanguageCode: enrichment.learningLanguageCode,
        deeplSourceCode: enrichment.deeplSourceCode,
        deeplTargetCode: enrichment.deeplTargetCode,
      })
      if (!result) throw new Error("No response")

      let filledSomething = false
      if (result.translation && !getValues("translation")) {
        setValue("translation", result.translation)
        filledSomething = true
      }
      if (result.wordType && !getValues("wordType")) {
        setValue("wordType", result.wordType)
        filledSomething = true
      }
      if (result.gender && !getValues("gender")) {
        setValue("gender", result.gender)
        filledSomething = true
      }
      if (result.plural && !getValues("plural")) {
        setValue("plural", result.plural)
        filledSomething = true
      }

      if (result.enrichmentStatus === "failed" || !filledSomething) {
        toast.info("Nothing found for that word", {
          description: "Fill in the fields manually -- nothing here is required.",
        })
      } else if (result.enrichmentStatus === "partial") {
        toast.success("Found some details", {
          description: "A few fields were filled in; the rest are still yours to complete.",
        })
      } else {
        toast.success("Filled in from DeepL + Wikidata")
      }
    } catch {
      toast.info("Look up isn't available right now", {
        description: "You can still fill in every field manually.",
      })
    }
  }

  async function handleFormSubmit(values: HiveWordFormValues) {
    await onSubmit(values)
    onOpenChange?.(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit(handleFormSubmit)}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="word">Word</Label>
            <div className="flex gap-2">
              <Input
                id="word"
                placeholder="casa"
                aria-invalid={Boolean(errors.word)}
                {...register("word")}
              />
              {enrichment && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleLookup}
                  disabled={enrichWord.isPending}
                >
                  {enrichWord.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Languages className="size-4" />
                  )}
                  Look up
                </Button>
              )}
            </div>
            {errors.word && <p className="text-sm text-destructive">{errors.word.message}</p>}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="translation">Translation</Label>
            <Input id="translation" placeholder="house" {...register("translation")} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label>Word type</Label>
              <Select
                value={wordType || undefined}
                onValueChange={(value) => setValue("wordType", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  {WORD_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Gender</Label>
              <Select
                value={gender || undefined}
                onValueChange={(value) => setValue("gender", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="If applicable" />
                </SelectTrigger>
                <SelectContent>
                  {GENDER_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="plural">Plural</Label>
              <Input id="plural" placeholder="Optional" {...register("plural")} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="topic">Topic</Label>
              <Input id="topic" placeholder="e.g. Food" {...register("topic")} />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="practiceSentence">Practice sentence</Label>
            <Textarea
              id="practiceSentence"
              rows={2}
              placeholder="Optional -- powers the Fill in the Blank game"
              {...register("practiceSentence")}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="teacherNotes">Teacher notes</Label>
            <Textarea id="teacherNotes" rows={2} placeholder="Optional" {...register("teacherNotes")} />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
