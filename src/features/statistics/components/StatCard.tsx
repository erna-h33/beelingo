import type { LucideIcon } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"

interface StatCardProps {
  icon: LucideIcon
  label: string
  value: number | string
}

export function StatCard({ icon: Icon, label, value }: StatCardProps) {
  return (
    <Card className="py-4">
      <CardContent className="flex items-center gap-3 px-4">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-4.5" />
        </div>
        <div>
          <p className="font-display text-xl font-semibold leading-none tabular-nums">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  )
}
