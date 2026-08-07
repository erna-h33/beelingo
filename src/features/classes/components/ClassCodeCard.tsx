import { useState } from "react"
import { Check, Copy, QrCode } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { QrCodeImage } from "./QrCodeImage"

interface ClassCodeCardProps {
  classCode: string
}

/** Displays a class's join code plus a copy button and a QR code dialog
 * -- the two things "View Class Code" / "Generate QR Code" need. */
export function ClassCodeCard({ classCode }: ClassCodeCardProps) {
  const [copied, setCopied] = useState(false)
  const joinUrl = `${window.location.origin}/join?code=${classCode}`

  async function handleCopy() {
    await navigator.clipboard.writeText(classCode)
    setCopied(true)
    toast.success("Class code copied")
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-2">
        <div>
          <p className="text-xs font-medium text-muted-foreground">Class code</p>
          <p className="text-2xl font-bold tracking-[0.25em]">{classCode}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleCopy}>
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            Copy code
          </Button>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="secondary" size="sm">
                <QrCode className="size-4" />
                Show QR
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xs">
              <DialogHeader>
                <DialogTitle>Scan to join</DialogTitle>
                <DialogDescription>
                  Students scan this with their phone camera to jump straight to the join
                  screen with the code pre-filled.
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col items-center gap-3 py-2">
                <QrCodeImage value={joinUrl} className="rounded-lg border border-border" />
                <p className="text-lg font-semibold tracking-[0.25em]">{classCode}</p>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  )
}
