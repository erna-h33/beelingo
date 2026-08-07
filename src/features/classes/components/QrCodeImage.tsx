import { useEffect, useState } from "react"
import QRCode from "qrcode"

import { Skeleton } from "@/components/ui/skeleton"

interface QrCodeImageProps {
  value: string
  size?: number
  className?: string
}

/**
 * Client-side generated QR code (see docs/architecture.md: "QR codes
 * generated client-side on the fly from class_code -- no storage needed,
 * always in sync"). Regenerates whenever `value` changes.
 */
export function QrCodeImage({ value, size = 220, className }: QrCodeImageProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setDataUrl(null)
    QRCode.toDataURL(value, { width: size, margin: 1 }).then((url) => {
      if (!cancelled) setDataUrl(url)
    })
    return () => {
      cancelled = true
    }
  }, [value, size])

  if (!dataUrl) {
    return <Skeleton className={className} style={{ width: size, height: size }} />
  }

  return (
    <img
      src={dataUrl}
      alt="Scan to join this class"
      width={size}
      height={size}
      className={className}
    />
  )
}
