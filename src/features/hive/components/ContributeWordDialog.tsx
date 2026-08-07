import { useState, type ReactNode } from "react"
import { Loader2, Plus } from "lucide-react"
import { toast } from "sonner"

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
import { useContributeWordMutation } from "@/features/hive/useContributions"
import type { StudentSessionResult } from "@/lib/supabase/types"

interface ContributeWordDialogProps {
  trigger: ReactNode
  session: StudentSessionResult
}

/** "What new word did you learn today?" -- just a word; everything else
 * comes from enrichment (or stays blank for the teacher to fill in). No
 * approval workflow -- it lands in the Hive immediately. */
export function ContributeWordDialog({ trigger, session }: ContributeWordDialogProps) {
  const [open, setOpen] = useState(false)
  const [word, setWord] = useState("")
  const contributeWord = useContributeWordMutation(session.classStudentId, session.classId)

  async function handleSubmit() {
    const trimmed = word.trim()
    if (!trimmed) return
    try {
      const result = await contributeWord.mutateAsync({
        word: trimmed,
        context: {
          learningLanguageCode: session.learningLanguage.code,
          deeplSourceCode: session.learningLanguage.deeplSourceCode,
          deeplTargetCode: session.displayLanguage.deeplTargetCode,
        },
      })
      toast.success(
        result.isNew ? `You added "${result.word}" to the Hive!` : `"${result.word}" is already in the Hive`,
        {
          description: result.isNew
            ? result.translation
              ? `It means "${result.translation}"`
              : undefined
            : "Thanks for reinforcing it!",
        },
      )
      setWord("")
      setOpen(false)
    } catch (error) {
      toast.error("Couldn't add that word", {
        description: error instanceof Error ? error.message : undefined,
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>What new word did you learn?</DialogTitle>
          <DialogDescription>Add it to your class's Hive.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="contribute-word">Word</Label>
          <Input
            id="contribute-word"
            autoFocus
            value={word}
            onChange={(e) => setWord(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmit()
            }}
            placeholder={session.learningLanguage.name}
          />
        </div>
        <DialogFooter>
          <Button onClick={handleSubmit} disabled={!word.trim() || contributeWord.isPending}>
            {contributeWord.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            Add to Hive
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
