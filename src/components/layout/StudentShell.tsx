import { NavLink, Outlet } from "react-router-dom"
import { Gamepad2, Hexagon, Home } from "lucide-react"

import { cn } from "@/lib/utils"
import { ThemeToggle } from "@/components/theme-toggle"
import { BeelingoLogo } from "@/components/BeelingoLogo"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
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
  const initial = session?.displayName.charAt(0).toUpperCase() || "S"

  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-border bg-card px-4">
        <div className="flex shrink-0 items-center gap-2">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <BeelingoLogo className="size-5" />
          </div>
          <span className="text-base font-semibold tracking-tight">Beelingo</span>
        </div>

        <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
          {session && (
            <div className="flex min-w-0 items-center gap-2 rounded-full border border-border py-1 pr-3 pl-1">
              <Avatar size="sm" className="shrink-0">
                <AvatarFallback className="bg-primary/15 font-semibold text-primary">
                  {initial}
                </AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-col leading-tight">
                <span className="truncate text-xs font-medium">{session.displayName}</span>
                <span className="truncate text-[11px] text-muted-foreground">
                  {session.className}
                  {session.learningLanguage.flagEmoji ? ` ${session.learningLanguage.flagEmoji}` : ""}
                </span>
              </div>
            </div>
          )}
          <ThemeToggle />
        </div>
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
