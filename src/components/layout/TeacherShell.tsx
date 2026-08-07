import { Link, NavLink, Outlet } from "react-router-dom"
import { Users, LayoutDashboard, GraduationCap } from "lucide-react"

import { cn } from "@/lib/utils"
import { ThemeToggle } from "@/components/theme-toggle"
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"

const NAV_ITEMS = [
  { to: "/t", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/t/classes", label: "Classes", icon: Users },
]

/**
 * Desktop-first shell for the teacher-facing app: persistent left sidebar,
 * dense information layout. Route-level auth guarding (RequireAuth) wraps
 * this shell's parent route, not the shell itself.
 */
export function TeacherShell() {
  return (
    <div className="flex min-h-dvh bg-background text-foreground">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
        <Link to="/t" className="flex items-center gap-2 px-5 py-5">
          <GraduationCap className="size-6 text-primary" />
          <span className="text-lg font-semibold tracking-tight">Beelingo</span>
        </Link>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )
              }
            >
              <item.icon className="size-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-border px-4 md:px-6">
          <Link to="/t" className="flex items-center gap-2 md:hidden">
            <GraduationCap className="size-5 text-primary" />
            <span className="font-semibold">Beelingo</span>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger className="rounded-full outline-none ring-ring/50 focus-visible:ring-2">
                <Avatar className="size-8">
                  <AvatarFallback className="bg-primary/15 text-primary text-xs font-semibold">
                    T
                  </AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem disabled>Account settings</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" disabled>
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
