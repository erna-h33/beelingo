import { forwardRef, useEffect, useImperativeHandle, useRef } from "react"
import { useTheme } from "next-themes"

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: TurnstileRenderOptions) => string
      remove: (widgetId: string) => void
      reset: (widgetId: string) => void
    }
  }
}

interface TurnstileRenderOptions {
  sitekey: string
  callback: (token: string) => void
  "expired-callback"?: () => void
  "error-callback"?: () => void
  theme?: "light" | "dark"
  /** "interaction-only" keeps the widget invisible unless Cloudflare's
   * risk engine actually needs to challenge this visitor -- the common
   * case is no visible UI at all, matching this app's zero-friction
   * join/login goals. */
  appearance?: "always" | "interaction-only"
}

// Loaded once per page, shared by every widget instance (LoginPage and
// JoinPage can both mount one across a session).
let scriptPromise: Promise<void> | null = null
function loadTurnstileScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve()
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script")
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js"
      script.async = true
      script.defer = true
      script.onload = () => resolve()
      script.onerror = () => reject(new Error("Couldn't load Turnstile"))
      document.head.appendChild(script)
    })
  }
  return scriptPromise
}

export interface TurnstileHandle {
  /** Tokens are single-use -- call this after any failed submit so the
   * next attempt gets a fresh one, rather than retrying with a token
   * the server will now reject. */
  reset: () => void
}

interface TurnstileWidgetProps {
  onVerify: (token: string) => void
  onExpire?: () => void
}

/** Cloudflare Turnstile, wired into Supabase Auth's captchaToken option
 * at each call site (teacher sign up/log in, student join) rather than
 * a form library plugin -- this app has no other CAPTCHA/bot-protection
 * surface, so a small self-contained component is simpler than a
 * dependency for what's ultimately "load a script, render a div." */
export const TurnstileWidget = forwardRef<TurnstileHandle, TurnstileWidgetProps>(
  function TurnstileWidget({ onVerify, onExpire }, ref) {
    const containerRef = useRef<HTMLDivElement>(null)
    const widgetIdRef = useRef<string | null>(null)
    const { resolvedTheme } = useTheme()

    useImperativeHandle(ref, () => ({
      reset: () => {
        if (widgetIdRef.current) window.turnstile?.reset(widgetIdRef.current)
      },
    }))

    useEffect(() => {
      let cancelled = false
      loadTurnstileScript()
        .then(() => {
          if (cancelled || !containerRef.current || !window.turnstile) return
          widgetIdRef.current = window.turnstile.render(containerRef.current, {
            sitekey: SITE_KEY,
            callback: onVerify,
            "expired-callback": onExpire,
            theme: resolvedTheme === "dark" ? "dark" : "light",
            appearance: "interaction-only",
          })
        })
        .catch(() => {
          // Fails open: if the script can't load (e.g. blocked by an
          // ad-blocker or offline), the surrounding form's submit button
          // just never gets a token, and Supabase enforces the actual
          // requirement server-side once CAPTCHA protection is turned on
          // there. Nothing here should hard-block the whole page.
        })
      return () => {
        cancelled = true
        if (widgetIdRef.current) window.turnstile?.remove(widgetIdRef.current)
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps -- re-rendering on every onVerify/onExpire identity change would tear down and re-solve the widget for no reason; theme changes are rare enough that a stale theme on toggle is an acceptable tradeoff over that.
    }, [])

    return <div ref={containerRef} />
  },
)
