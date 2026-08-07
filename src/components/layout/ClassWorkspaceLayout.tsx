import { useState } from "react"
import { Link, NavLink, Outlet, useParams } from "react-router-dom"
import { ArrowLeft, Pencil, Sparkles, Gamepad2, BarChart3, Users } from "lucide-react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useClassQuery, useUpdateClassMutation } from "@/features/classes/useClasses"
import { ClassCodeCard } from "@/features/classes/components/ClassCodeCard"
import { ClassFormDialog } from "@/features/classes/components/ClassFormDialog"

const TABS = [
  { to: "hive", label: "Hive", icon: Sparkles },
  { to: "students", label: "Students", icon: Users },
  { to: "games", label: "Games", icon: Gamepad2 },
  { to: "statistics", label: "Statistics", icon: BarChart3 },
]

/** Header (name, language pair, class code + QR) and tab nav shared by
 * every screen inside a single class. Hive/Games/Statistics are
 * placeholders until M5/M9/M10 land -- Students (roster) is real. */
export function ClassWorkspaceLayout() {
  const { classId } = useParams<{ classId: string }>()
  const { data: classItem, isLoading } = useClassQuery(classId)
  const updateClass = useUpdateClassMutation()
  const [editOpen, setEditOpen] = useState(false)

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24" />
      </div>
    )
  }

  if (!classItem) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <p className="font-medium">Class not found</p>
        <Button asChild variant="outline">
          <Link to="/t/classes">
            <ArrowLeft className="size-4" />
            Back to classes
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link
          to="/t/classes"
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Classes
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{classItem.name}</h1>
            <p className="text-sm text-muted-foreground">
              {classItem.learning_language.flag_emoji} {classItem.learning_language.name}
              <span className="mx-1.5 text-muted-foreground/60">→</span>
              {classItem.display_language.flag_emoji} {classItem.display_language.name}
            </p>
          </div>
          <ClassFormDialog
            open={editOpen}
            onOpenChange={setEditOpen}
            trigger={
              <Button variant="outline" size="sm">
                <Pencil className="size-4" />
                Edit class
              </Button>
            }
            title="Edit class"
            description="Update the name or language pair."
            submitLabel="Save changes"
            defaultValues={{
              name: classItem.name,
              learningLanguageId: classItem.learning_language.id,
              displayLanguageId: classItem.display_language.id,
            }}
            onSubmit={async (values) => {
              try {
                await updateClass.mutateAsync({ classId: classItem.id, ...values })
                toast.success("Class updated")
              } catch (error) {
                toast.error("Couldn't update class", {
                  description: error instanceof Error ? error.message : undefined,
                })
              }
            }}
          />
        </div>
      </div>

      <ClassCodeCard classCode={classItem.class_code} />

      <div className="border-b border-border">
        <nav className="flex gap-1">
          {TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )
              }
            >
              <tab.icon className="size-4" />
              {tab.label}
            </NavLink>
          ))}
        </nav>
      </div>

      <Outlet />
    </div>
  )
}
