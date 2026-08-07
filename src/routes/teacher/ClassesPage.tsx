import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Plus, Users } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/features/auth/useAuth"
import { useLanguagesQuery } from "@/features/classes/useLanguages"
import { useClassesQuery, useCreateClassMutation } from "@/features/classes/useClasses"
import { ClassCard } from "@/features/classes/components/ClassCard"
import { ClassFormDialog } from "@/features/classes/components/ClassFormDialog"
import type { ClassFormValues } from "@/features/classes/schemas"

export default function ClassesPage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const { data: classes, isLoading } = useClassesQuery()
  const { data: languages } = useLanguagesQuery()
  const createClass = useCreateClassMutation()
  const [createOpen, setCreateOpen] = useState(false)

  const englishId = languages?.find((l) => l.code === "en")?.id ?? ""

  async function handleCreate(values: ClassFormValues) {
    if (!session) return
    try {
      const created = await createClass.mutateAsync({
        teacherId: session.user.id,
        name: values.name,
        learningLanguageId: values.learningLanguageId,
        displayLanguageId: values.displayLanguageId,
      })
      toast.success(`${values.name} created`)
      navigate(`/t/classes/${created.id}`)
    } catch (error) {
      toast.error("Couldn't create class", {
        description: error instanceof Error ? error.message : undefined,
      })
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Classes</h1>
          <p className="text-sm text-muted-foreground">
            Each class has its own code, roster, and Hive.
          </p>
        </div>
        <ClassFormDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          trigger={
            <Button>
              <Plus className="size-4" />
              Create class
            </Button>
          }
          title="Create a class"
          description="You can always change these details later."
          submitLabel="Create class"
          defaultValues={{ name: "", learningLanguageId: "", displayLanguageId: englishId }}
          onSubmit={handleCreate}
        />
      </div>

      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      )}

      {!isLoading && classes && classes.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center">
          <Users className="size-8 text-muted-foreground" />
          <div>
            <p className="font-medium">No classes yet</p>
            <p className="text-sm text-muted-foreground">
              Create your first class to get a code, a QR code, and a Hive.
            </p>
          </div>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            Create class
          </Button>
        </div>
      )}

      {!isLoading && classes && classes.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {classes.map((classItem) => (
            <ClassCard key={classItem.id} classItem={classItem} />
          ))}
        </div>
      )}
    </div>
  )
}
