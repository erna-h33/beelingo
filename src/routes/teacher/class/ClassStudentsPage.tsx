import { useParams } from "react-router-dom"
import { Plus, Users } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useStudentsQuery } from "@/features/classes/students/useStudents"
import { AddStudentsDialog } from "@/features/classes/students/components/AddStudentsDialog"
import { RosterTable } from "@/features/classes/students/components/RosterTable"

export default function ClassStudentsPage() {
  const { classId } = useParams<{ classId: string }>()
  const { data: students, isLoading } = useStudentsQuery(classId)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold">Roster</h2>
          <p className="text-sm text-muted-foreground">
            Students pick their name from this list when they join with the class code.
          </p>
        </div>
        {classId && (
          <AddStudentsDialog
            classId={classId}
            trigger={
              <Button size="sm">
                <Plus className="size-4" />
                Add students
              </Button>
            }
          />
        )}
      </div>

      {isLoading && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10" />
          ))}
        </div>
      )}

      {!isLoading && students && students.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center">
          <Users className="size-8 text-muted-foreground" />
          <div>
            <p className="font-medium">No students yet</p>
            <p className="text-sm text-muted-foreground">
              Add your roster so students can pick their name when they join.
            </p>
          </div>
        </div>
      )}

      {!isLoading && students && students.length > 0 && classId && (
        <RosterTable classId={classId} students={students} />
      )}
    </div>
  )
}
