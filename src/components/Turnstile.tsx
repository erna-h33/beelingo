import { forwardRef, useEffect, useImperativeHandle, useRef } from "react"
import { useTheme } from "next-themes"

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY

/** How long to wait for the widget to *load and render* before treating
 * Turnstile as unavailable (blocked script, ad-blocker, network/CDN
 * failure) and letting the caller proceed without a token. Deliberately
 * only covers getting the widget on screen, never the time after that --
 * once it's rendered and showing a real visible challenge, an untouched
 * checkbox must never silently expire into "unavailable," or a genuine
 * human-verification requirement would quietly stop applying to anyone
 * who takes more than a few seconds to notice and click it. */
const RENDER_TIMEOUT_MS = 10_000

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
   * join/login goals. Whether a given visit needs the visible checkbox
   * is Cloudflare's own per-visit risk call, not something this app
   * controls or should try to force one way or the other. */
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
  /** Fires once, at most, if Turnstile never even gets on screen
   * (script blocked, network failure, nothing rendered within
   * RENDER_TIMEOUT_MS) or Cloudflare itself reports a real error --
   * never for "rendered fine, waiting on the user to click it." The
   * signal callers use to stop waiting and let the user proceed without
   * a token, rather than disabling their submit button forever.
   * Supabase still enforces the real requirement server-side; this only
   * affects how the *client* degrades. */
  onUnavailable?: () => void
}

/** Cloudflare Turnstile, wired into Supabase Auth's captchaToken option
 * at each call site (teacher sign up/log in, student join) rather than
 * a form library plugin -- this app has no other CAPTCHA/bot-protection
 * surface, so a small self-contained component is simpler than a
 * dependency for what's ultimately "load a script, render a div." */
export const TurnstileWidget = forwardRef<TurnstileHandle, TurnstileWidgetProps>(
  function TurnstileWidget({ onVerify, onExpire, onUnavailable }, ref) {
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
      let settled = false
      const giveUp = () => {
        if (settled) return
        settled = true
        onUnavailable?.()
      }
      // Only guards script-load-and-render -- cleared the instant
      // render() is actually called, whether or not that then shows a
      // visible challenge. See RENDER_TIMEOUT_MS.
      const renderTimer = setTimeout(giveUp, RENDER_TIMEOUT_MS)

      loadTurnstileScript()
        .then(() => {
          clearTimeout(renderTimer)
          if (cancelled || !containerRef.current || !window.turnstile) return
          widgetIdRef.current = window.turnstile.render(containerRef.current, {
            sitekey: SITE_KEY,
            callback: (token) => {
              settled = true
              onVerify(token)
            },
            "expired-callback": onExpire,
            "error-callback": giveUp,
            theme: resolvedTheme === "dark" ? "dark" : "light",
            appearance: "interaction-only",
          })
        })
        .catch(giveUp)

      return () => {
        cancelled = true
        clearTimeout(renderTimer)
        if (widgetIdRef.current) window.turnstile?.remove(widgetIdRef.current)
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps -- re-rendering on every onVerify/onExpire/onUnavailable identity change would tear down and re-solve the widget for no reason; theme changes are rare enough that a stale theme on toggle is an acceptable tradeoff over that.
    }, [])

    return <div ref={containerRef} />
  },
)
