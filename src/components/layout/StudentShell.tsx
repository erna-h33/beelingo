import { NavLink, Outlet } from "react-router-dom"
import { Gamepad2, Hexagon, Home } from "lucide-react"

import { cn } from "@/lib/utils"
import { ThemeToggle } from "@/components/theme-toggle"
import { useStudentSessionQuery } from "@/features/studentSession/useStudentSession"

const NAV_ITEMS = [
  { to: "/s", label: "Home", icon: Home, end: true },
  { to: "/s/hive", label: "Hive", icon: Hexagon },
  { to: "/s/game", label: "Game", icon: Gamepad2 },
]

/**
 * Mobile-first shell for the student-facing app: large tap targets, a
 * bottom tab bar (thumb-reachable), minimal chrome. Route-level device
 * guarding (RequireDevice) wraps this shell's parent route.
 */
export function StudentShell() {
  const { data: session } = useStudentSessionQuery()

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
        <div className="flex flex-col leading-tight">
          <span className="text-base font-semibold tracking-tight">Beelingo</span>
          {session && (
            <span className="text-xs text-muted-foreground">
              {session.displayName} · {session.className}
            </span>
          )}
        </div>
        <ThemeToggle />
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-5 pb-24">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
        <div className="mx-auto flex max-w-md items-stretch justify-around">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground",
                )
              }
            >
              <item.icon className="size-5" />
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
