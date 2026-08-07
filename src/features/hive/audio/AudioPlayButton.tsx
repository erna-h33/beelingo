import { useRef, useState } from "react"
import { Loader2, Volume2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useSignedAudioUrlQuery } from "@/features/hive/audio/useTeacherAudio"

/** Renders nothing when `path` is null -- "if no recording exists,
 * simply hide the play button" (docs/architecture.md). */
export function AudioPlayButton({ path }: { path: string | null }) {
  const [enabled, setEnabled] = useState(false)
  const { data: url, isFetching } = useSignedAudioUrlQuery(enabled ? path : null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  if (!path) return null

  function handleClick() {
    if (!enabled) {
      setEnabled(true)
      return
    }
    audioRef.current?.play()
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8"
        aria-label="Play pronunciation"
        onClick={handleClick}
        disabled={enabled && isFetching}
      >
        {enabled && isFetching ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Volume2 className="size-4" />
        )}
      </Button>
      {url && (
        <audio
          ref={audioRef}
          src={url}
          className="hidden"
          onCanPlay={(e) => e.currentTarget.play()}
        />
      )}
    </>
  )
}
