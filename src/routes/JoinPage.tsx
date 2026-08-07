import { useEffect, useRef, useState, type FormEvent } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { ArrowLeft, ArrowRight, GraduationCap, Loader2 } from "lucide-react"
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
import { useStudentSessionQuery } from "@/features/studentSession/useStudentSession"
import { useJoinClassMutation, useLookupClassByCode } from "@/features/studentSession/useJoinFlow"
import type { LookupClassResult } from "@/lib/supabase/types"

/**
 * Student join flow: enter class code -> pick your name -> recognized on
 * this device from then on. No email, no password, no account creation.
 */
export default function JoinPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { data: existingSession, isLoading: sessionLoading } = useStudentSessionQuery()

  const [code, setCode] = useState(() => (searchParams.get("code") ?? "").toUpperCase().slice(0, 6))
  const [found, setFound] = useState<LookupClassResult | null>(null)
  const lookupClass = useLookupClassByCode()
  const joinClass = useJoinClassMutation()
  const autoLookedUp = useRef(false)

  // Already recognized on this device -- skip straight to the dashboard.
  useEffect(() => {
    if (!sessionLoading && existingSession) {
      navigate("/s", { replace: true })
    }
  }, [sessionLoading, existingSession, navigate])

  async function handleLookup(event?: FormEvent) {
    event?.preventDefault()
    try {
      const result = await lookupClass.mutateAsync(code)
      setFound(result)
    } catch (error) {
      toast.error("Class not found", {
        description: error instanceof Error ? error.message : "Double-check the code and try again.",
      })
    }
  }

  // Scanning the teacher's QR (?code=XXXXXX) jumps straight to name-picking.
  useEffect(() => {
    if (!autoLookedUp.current && code.length === 6 && !sessionLoading && !existingSession) {
      autoLookedUp.current = true
      handleLookup()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, sessionLoading, existingSession])

  async function handlePickName(classStudentId: string) {
    try {
      await joinClass.mutateAsync(classStudentId)
      navigate("/s", { replace: true })
    } catch (error) {
      toast.error("Couldn't join the class", {
        description: error instanceof Error ? error.message : undefined,
      })
    }
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

      {!found ? (
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Join your class</CardTitle>
            <CardDescription>Enter the class code your teacher gave you.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="flex flex-col gap-4" onSubmit={handleLookup}>
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
              <Button type="submit" size="lg" disabled={code.length < 4 || lookupClass.isPending}>
                {lookupClass.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <>
                    Continue
                    <ArrowRight className="size-4" />
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Card className="w-full max-w-sm">
          <CardHeader>
            <button
              type="button"
              onClick={() => setFound(null)}
              className="mb-1 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" />
              Different code
            </button>
            <CardTitle>{found.class.name}</CardTitle>
            <CardDescription>
              {found.class.learningLanguage.flagEmoji} {found.class.learningLanguage.name}
              <span className="mx-1.5 text-muted-foreground/60">→</span>
              {found.class.displayLanguage.flagEmoji} {found.class.displayLanguage.name}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-sm font-medium">Which one are you?</p>
            {found.roster.length === 0 ? (
              <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
                Your teacher hasn't added any students to this class yet.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {found.roster.map((student) => (
                  <Button
                    key={student.id}
                    variant="outline"
                    size="lg"
                    className="justify-start text-base"
                    disabled={joinClass.isPending}
                    onClick={() => handlePickName(student.id)}
                  >
                    {joinClass.isPending && joinClass.variables === student.id && (
                      <Loader2 className="size-4 animate-spin" />
                    )}
                    {student.displayName}
                  </Button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
        Are you a teacher?
      </Link>
    </div>
  )
}
