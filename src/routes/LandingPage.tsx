import { Link } from "react-router-dom"
import { GraduationCap, QrCode, Users } from "lucide-react"

import { Button } from "@/components/ui/button"
import { BeelingoLogo } from "@/components/BeelingoLogo"
import { ThemeToggle } from "@/components/theme-toggle"
import { Card, CardContent } from "@/components/ui/card"

/**
 * Entry point: a two-path role picker. Teachers go to the auth-gated app,
 * students go straight to the class-code join flow — no account, no
 * "sign up" friction, matching the "minimal clicks" design goal.
 */
export default function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <BeelingoLogo className="size-6 text-primary" />
          <span className="text-lg font-semibold tracking-tight">Beelingo</span>
        </div>
        <ThemeToggle />
      </header>

      <main className="flex flex-1 flex-col items-center justify-center gap-10 px-6 py-12">
        <div className="max-w-lg text-center">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Grow your class's Hive, together.
          </h1>
          <p className="mt-3 text-muted-foreground">
            Students contribute new words after every class. The Hive turns
            straight into fun, live classroom games.
          </p>
        </div>

        <div className="grid w-full max-w-2xl gap-4 sm:grid-cols-2">
          <Card className="transition-shadow hover:shadow-md">
            <CardContent className="flex flex-col items-start gap-3 pt-2">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <GraduationCap className="size-5" />
              </div>
              <div>
                <h2 className="font-semibold">I'm a teacher</h2>
                <p className="text-sm text-muted-foreground">
                  Create classes, grow the Hive, and run live games.
                </p>
              </div>
              <Button asChild className="w-full">
                <Link to="/t">Go to my dashboard</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="transition-shadow hover:shadow-md">
            <CardContent className="flex flex-col items-start gap-3 pt-2">
              <div className="flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <Users className="size-5" />
              </div>
              <div>
                <h2 className="font-semibold">I'm a student</h2>
                <p className="text-sm text-muted-foreground">
                  Enter your class code — no account needed.
                </p>
              </div>
              <Button asChild variant="secondary" className="w-full">
                <Link to="/join">
                  <QrCode className="size-4" />
                  Join a class
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
