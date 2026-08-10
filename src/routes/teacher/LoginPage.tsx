import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import { supabase } from "@/lib/supabase/client"
import { useAuth } from "@/features/auth/useAuth"
import { authFormSchema, type AuthFormValues } from "@/features/auth/schemas"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { BeelingoLogo } from "@/components/BeelingoLogo"
import { ThemeToggle } from "@/components/theme-toggle"
import { TurnstileWidget, type TurnstileHandle } from "@/components/Turnstile"
import { cn } from "@/lib/utils"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type Mode = "login" | "signup"

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("login")
  const navigate = useNavigate()
  const { status } = useAuth()
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  // See JoinPage's identical guard: without this, submitting before
  // Turnstile finishes sends the request with no token at all, which
  // Supabase now rejects outright rather than silently allowing.
  const [captchaUnavailable, setCaptchaUnavailable] = useState(false)
  const turnstileRef = useRef<TurnstileHandle>(null)
  const readyToSubmit = Boolean(captchaToken) || captchaUnavailable

  useEffect(() => {
    if (status === "authenticated") {
      navigate("/t", { replace: true })
    }
  }, [status, navigate])

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AuthFormValues>({
    resolver: zodResolver(authFormSchema),
  })

  async function onSubmit(values: AuthFormValues) {
    const options = captchaToken ? { captchaToken } : undefined

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ ...values, options })
      if (error) {
        toast.error("Couldn't log you in", { description: error.message })
        turnstileRef.current?.reset()
        return
      }
      navigate("/t", { replace: true })
      return
    }

    const { data, error } = await supabase.auth.signUp({ ...values, options })
    if (error) {
      toast.error("Couldn't create your account", { description: error.message })
      turnstileRef.current?.reset()
      return
    }
    if (data.session) {
      // Email confirmation is disabled on this project -- signed in immediately.
      navigate("/t", { replace: true })
      return
    }
    toast.success("Check your email to confirm your account", {
      description: "Once confirmed, log in below.",
    })
    setMode("login")
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-background px-4 text-foreground">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="flex items-center gap-2">
        <BeelingoLogo className="size-7 text-primary" />
        <span className="text-xl font-semibold tracking-tight">Beelingo</span>
      </div>

      <Card className="w-full max-w-sm">
        <CardHeader>
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
            <button
              type="button"
              onClick={() => setMode("login")}
              className={cn(
                "rounded-md py-1.5 text-sm font-medium transition-colors",
                mode === "login"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground",
              )}
            >
              Log in
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={cn(
                "rounded-md py-1.5 text-sm font-medium transition-colors",
                mode === "signup"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground",
              )}
            >
              Sign up
            </button>
          </div>
          <CardTitle className="mt-2">
            {mode === "login" ? "Welcome back" : "Create your account"}
          </CardTitle>
          <CardDescription>
            {mode === "login"
              ? "Log in to manage your classes and Hive."
              : "Set up your teacher account -- no approval needed."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                aria-invalid={Boolean(errors.email)}
                {...register("email")}
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                aria-invalid={Boolean(errors.password)}
                {...register("password")}
              />
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password.message}</p>
              )}
            </div>
            <TurnstileWidget
              ref={turnstileRef}
              onVerify={setCaptchaToken}
              onExpire={() => setCaptchaToken(null)}
              onUnavailable={() => setCaptchaUnavailable(true)}
            />
            <Button type="submit" size="lg" disabled={isSubmitting || !readyToSubmit}>
              {(isSubmitting || !readyToSubmit) && <Loader2 className="size-4 animate-spin" />}
              {mode === "login" ? "Log in" : "Create account"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
