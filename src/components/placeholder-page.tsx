import type { LucideIcon } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface PlaceholderPageProps {
  icon: LucideIcon
  title: string
  description: string
  milestone: string
}

/**
 * Placeholder for a route whose real implementation lands in a later
 * milestone. Keeps the M1 demo navigable and legible instead of blank
 * screens, and makes it obvious in the UI which milestone fills it in.
 */
export function PlaceholderPage({
  icon: Icon,
  title,
  description,
  milestone,
}: PlaceholderPageProps) {
  return (
    <Card className="mx-auto max-w-xl border-dashed">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Icon className="size-5" />
          </div>
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Badge variant="secondary">Coming in {milestone}</Badge>
      </CardContent>
    </Card>
  )
}
