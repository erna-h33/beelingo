import { useState } from "react"
import { Check, Pencil, RotateCcw, UserMinus, X } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import {
  useRenameStudentMutation,
  useSetStudentActiveMutation,
  type RosterStudent,
} from "@/features/classes/students/useStudents"

export function RosterTable({ classId, students }: { classId: string; students: RosterStudent[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Joined</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {students.map((student) => (
          <RosterRow key={student.id} classId={classId} student={student} />
        ))}
      </TableBody>
    </Table>
  )
}

function RosterRow({ classId, student }: { classId: string; student: RosterStudent }) {
  const [editing, setEditing] = useState(false)
  const [draftName, setDraftName] = useState(student.display_name)
  const renameStudent = useRenameStudentMutation(classId)
  const setActive = useSetStudentActiveMutation(classId)

  async function handleSaveRename() {
    const trimmed = draftName.trim()
    if (!trimmed || trimmed === student.display_name) {
      setEditing(false)
      setDraftName(student.display_name)
      return
    }
    try {
      await renameStudent.mutateAsync({ studentId: student.id, displayName: trimmed })
      setEditing(false)
    } catch (error) {
      toast.error("Couldn't rename student", {
        description: error instanceof Error ? error.message : undefined,
      })
    }
  }

  async function handleToggleActive() {
    try {
      await setActive.mutateAsync({ studentId: student.id, isActive: !student.is_active })
    } catch (error) {
      toast.error("Couldn't update student", {
        description: error instanceof Error ? error.message : undefined,
      })
    }
  }

  return (
    <TableRow className={cn(!student.is_active && "opacity-60")}>
      <TableCell>
        {editing ? (
          <div className="flex items-center gap-1.5">
            <Input
              autoFocus
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveRename()
                if (e.key === "Escape") {
                  setEditing(false)
                  setDraftName(student.display_name)
                }
              }}
              className="h-8 max-w-48"
            />
            <Button size="icon" variant="ghost" className="size-8" onClick={handleSaveRename}>
              <Check className="size-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="size-8"
              onClick={() => {
                setEditing(false)
                setDraftName(student.display_name)
              }}
            >
              <X className="size-4" />
            </Button>
          </div>
        ) : (
          <button
            type="button"
            className="group flex items-center gap-1.5 text-left"
            onClick={() => setEditing(true)}
          >
            {student.display_name}
            <Pencil className="size-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
          </button>
        )}
      </TableCell>
      <TableCell>
        <Badge variant={student.is_active ? "secondary" : "outline"}>
          {student.is_active ? "Active" : "Removed"}
        </Badge>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {new Date(student.joined_at).toLocaleDateString()}
      </TableCell>
      <TableCell className="text-right">
        <Button variant="ghost" size="sm" onClick={handleToggleActive}>
          {student.is_active ? (
            <>
              <UserMinus className="size-4" />
              Remove
            </>
          ) : (
            <>
              <RotateCcw className="size-4" />
              Restore
            </>
          )}
        </Button>
      </TableCell>
    </TableRow>
  )
}
