import { Search } from "lucide-react"

import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface HiveSearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  /** Extra classes on the outer wrapper -- e.g. the teacher's Hive page
   * sizes this alongside a topic filter in the same row
   * (flex-1 min-w-48), which a shared component shouldn't assume. */
  className?: string
  /** Keeps the bar pinned to the top of its scroll container as the
   * list scrolls past it. Opt-in per call site, not the default -- the
   * teacher's Hive page pairs this with a topic filter and hasn't asked
   * for sticky behavior, so it stays in normal flow there. */
  sticky?: boolean
}

/** The "search words or translations" input, identical on the teacher's
 * Hive page and both tabs of the student's -- one shared component
 * instead of three copies of the same icon+Input markup. */
export function HiveSearchInput({
  value,
  onChange,
  placeholder = "Search words or translations",
  className,
  sticky,
}: HiveSearchInputProps) {
  return (
    <div className={cn(sticky && "sticky top-0 z-10 bg-background py-2", className)}>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} className="pl-8" />
      </div>
    </div>
  )
}
