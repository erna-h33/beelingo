import { useState, type ReactNode } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
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
import { useAddStudentsMutation } from "@/features/classes/students/useStudents"

interface AddStudentsDialogProps {
  classId: string
  trigger: ReactNode
}

/** One textarea handles both "add one student" and "paste the whole
 * roster at once" -- one name per line, blank lines ignored. */
export function AddStudentsDialog({ classId, trigger }: AddStudentsDialogProps) {
  const [open, setOpen] = useState(false)
  const [namesText, setNamesText] = useState("")
  const addStudents = useAddStudentsMutation(classId)

  const names = namesText
    .split("\n")
    .map((n) => n.trim())
    .filter(Boolean)

  async function handleSubmit() {
    if (names.length === 0) return
    try {
      await addStudents.mutateAsync(names)
      toast.success(names.length === 1 ? "Student added" : `${names.length} students added`)
      setNamesText("")
      setOpen(false)
    } catch (error) {
      toast.error("Couldn't add students", {
        description: error instanceof Error ? error.message : undefined,
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add students</DialogTitle>
          <DialogDescription>
            One name per line. Paste your whole roster at once, or add a single student.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="student-names">Names</Label>
          <Textarea
            id="student-names"
            rows={8}
            placeholder={"Ana\nJoão\nMaria\nCarlos"}
            value={namesText}
            onChange={(e) => setNamesText(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            {names.length} {names.length === 1 ? "name" : "names"} ready to add
          </p>
        </div>
        <DialogFooter>
          <Button onClick={handleSubmit} disabled={names.length === 0 || addStudents.isPending}>
            {addStudents.isPending && <Loader2 className="size-4 animate-spin" />}
            Add {names.length > 0 ? names.length : ""} {names.length === 1 ? "student" : "students"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
