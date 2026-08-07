import { useState, type FormEvent } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { ArrowRight, GraduationCap } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ThemeToggle } from "@/components/theme-toggle"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

/**
 * Visual shell for the student join flow (enter class code -> pick your
 * name). Real class-code lookup + Anonymous Auth session issuance lands
 * in M4 — this milestone only wires up the UI shape and layout.
 */
export default function JoinPage() {
  const [searchParams] = useSearchParams()
  const [code, setCode] = useState(() => (searchParams.get("code") ?? "").toUpperCase().slice(0, 6))

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    toast.info("Class join is coming in M4", {
      description: "This screen will look up your class and let you pick your name.",
    })
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-background px-4 text-foreground">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="flex items-center gap-2">
        <GraduationCap className="size-7 text-primary" />
        <span className="text-xl font-semibold tracking-tight">Beelingo</span>
      </div>

      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Join your class</CardTitle>
          <CardDescription>Enter the class code your teacher gave you.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="class-code">Class code</Label>
              <Input
                id="class-code"
                placeholder="A7XK92"
                autoComplete="off"
                autoCapitalize="characters"
                maxLength={6}
                className="text-center text-lg font-semibold tracking-[0.3em] uppercase"
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
              />
            </div>
            <Button type="submit" size="lg" disabled={code.length < 4}>
              Continue
              <ArrowRight className="size-4" />
            </Button>
          </form>
        </CardContent>
      </Card>

      <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
        Are you a teacher?
      </Link>
    </div>
  )
}
