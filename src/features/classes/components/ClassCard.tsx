import { Link } from "react-router-dom"
import { ArrowRight, Archive, Users } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useArchiveClassMutation, type ClassSummary } from "@/features/classes/useClasses"

export function ClassCard({ classItem }: { classItem: ClassSummary }) {
  const archiveClass = useArchiveClassMutation()
  const activeStudentCount = classItem.class_students.filter((s) => s.is_active).length

  async function handleArchive() {
    try {
      await archiveClass.mutateAsync(classItem.id)
      toast.success(`${classItem.name} archived`)
    } catch (error) {
      toast.error("Couldn't archive class", {
        description: error instanceof Error ? error.message : undefined,
      })
    }
  }

  return (
    <Card className="group relative transition-shadow hover:shadow-md">
      <CardContent className="flex flex-col gap-3 pt-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-semibold">{classItem.name}</h3>
            <p className="text-sm text-muted-foreground">
              {classItem.learning_language.flag_emoji} {classItem.learning_language.name}
              <span className="mx-1.5 text-muted-foreground/60">→</span>
              {classItem.display_language.flag_emoji} {classItem.display_language.name}
            </p>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground opacity-0 group-hover:opacity-100"
                aria-label={`Archive ${classItem.name}`}
                onClick={(e) => e.stopPropagation()}
              >
                <Archive className="size-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Archive {classItem.name}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This hides the class from your active list. Its roster, Hive, and history are
                  kept -- nothing is deleted.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleArchive}>Archive</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Users className="size-4" />
              {activeStudentCount}
            </span>
            <span className="font-mono text-xs tracking-widest">{classItem.class_code}</span>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link to={`/t/classes/${classItem.id}`}>
              Open
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
