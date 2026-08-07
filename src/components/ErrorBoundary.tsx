import { Component, type ErrorInfo, type ReactNode } from "react"
import { RotateCcw, TriangleAlert } from "lucide-react"

import { Button } from "@/components/ui/button"

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
}

/**
 * Last-resort catch for uncaught render errors -- without this, a bug
 * anywhere in the tree (a bad Supabase response shape, a null-ref in a
 * game payload, etc.) blanks the entire app to a white screen with no
 * way back except a manual URL edit. Class component because React
 * error boundaries have no hook equivalent (getDerivedStateFromError/
 * componentDidCatch are class-only lifecycle methods).
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary] Uncaught render error:", error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-4 text-center text-foreground">
          <TriangleAlert className="size-10 text-destructive" />
          <div>
            <p className="text-lg font-semibold">Something went wrong</p>
            <p className="text-sm text-muted-foreground">
              Try reloading the page. If this keeps happening, let your teacher or admin know.
            </p>
          </div>
          <Button onClick={() => window.location.reload()}>
            <RotateCcw className="size-4" />
            Reload
          </Button>
        </div>
      )
    }

    return this.props.children
  }
}
