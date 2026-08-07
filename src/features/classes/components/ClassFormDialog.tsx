import { useEffect, type ReactNode } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { useLanguagesQuery } from "@/features/classes/useLanguages"
import { classFormSchema, type ClassFormValues } from "@/features/classes/schemas"

interface ClassFormDialogProps {
  trigger: ReactNode
  title: string
  description: string
  submitLabel: string
  defaultValues?: ClassFormValues
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onSubmit: (values: ClassFormValues) => Promise<void>
}

const EMPTY_DEFAULTS: ClassFormValues = {
  name: "",
  learningLanguageId: "",
  displayLanguageId: "",
}

/** Shared form used by both "Create class" and "Edit class" -- only the
 * trigger, copy, and submit handler differ between the two call sites. */
export function ClassFormDialog({
  trigger,
  title,
  description,
  submitLabel,
  defaultValues,
  open,
  onOpenChange,
  onSubmit,
}: ClassFormDialogProps) {
  const { data: languages, isLoading: languagesLoading } = useLanguagesQuery()

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ClassFormValues>({
    resolver: zodResolver(classFormSchema),
    defaultValues: defaultValues ?? EMPTY_DEFAULTS,
  })

  // Re-sync the form whenever the dialog is (re)opened with new defaults
  // (e.g. editing a different class, or the English default resolving
  // after languages finish loading for a fresh "create" form).
  useEffect(() => {
    if (open) reset(defaultValues ?? EMPTY_DEFAULTS)
  }, [open, defaultValues, reset])

  async function handleFormSubmit(values: ClassFormValues) {
    await onSubmit(values)
    onOpenChange?.(false)
  }

  const learningLanguageId = watch("learningLanguageId")
  const displayLanguageId = watch("displayLanguageId")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit(handleFormSubmit)}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="class-name">Class name</Label>
            <Input
              id="class-name"
              placeholder="Monday Morning"
              aria-invalid={Boolean(errors.name)}
              {...register("name")}
            />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>

          <div className="flex flex-col gap-2">
            <Label>Learning language</Label>
            <Select
              value={learningLanguageId}
              onValueChange={(value) => setValue("learningLanguageId", value, { shouldValidate: true })}
              disabled={languagesLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="What are students learning?" />
              </SelectTrigger>
              <SelectContent>
                {languages?.map((lang) => (
                  <SelectItem key={lang.id} value={lang.id}>
                    {lang.flag_emoji} {lang.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.learningLanguageId && (
              <p className="text-sm text-destructive">{errors.learningLanguageId.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label>Display language</Label>
            <Select
              value={displayLanguageId}
              onValueChange={(value) => setValue("displayLanguageId", value, { shouldValidate: true })}
              disabled={languagesLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="What language do translations show in?" />
              </SelectTrigger>
              <SelectContent>
                {languages?.map((lang) => (
                  <SelectItem key={lang.id} value={lang.id}>
                    {lang.flag_emoji} {lang.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.displayLanguageId && (
              <p className="text-sm text-destructive">{errors.displayLanguageId.message}</p>
            )}
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
