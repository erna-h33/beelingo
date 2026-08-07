import { useCallback, useRef, useState } from "react"

function pickMimeType(): string {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/mpeg"]
  for (const type of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported?.(type)) {
      return type
    }
  }
  return "" // let the browser pick
}

export type RecorderState = "idle" | "requesting" | "recording" | "recorded" | "error"

/**
 * Thin wrapper around the browser's native MediaRecorder API -- no
 * dependency needed. Real teacher recordings only; never AI/synthesized
 * speech (see docs/architecture.md).
 */
export function useAudioRecorder() {
  const [state, setState] = useState<RecorderState>("idle")
  const [durationMs, setDurationMs] = useState(0)
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const startedAtRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const start = useCallback(async () => {
    setErrorMessage(null)
    setState("requesting")
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mimeType = pickMimeType()
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      chunksRef.current = []
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType || "audio/webm" })
        setRecordedBlob(blob)
        setState("recorded")
        stopTimer()
        streamRef.current?.getTracks().forEach((track) => track.stop())
        streamRef.current = null
      }
      mediaRecorderRef.current = recorder
      recorder.start()
      startedAtRef.current = Date.now()
      setDurationMs(0)
      timerRef.current = setInterval(() => {
        setDurationMs(Date.now() - startedAtRef.current)
      }, 200)
      setState("recording")
    } catch (error) {
      setState("error")
      setErrorMessage(
        error instanceof Error ? error.message : "Couldn't access the microphone",
      )
    }
  }, [stopTimer])

  const stop = useCallback(() => {
    mediaRecorderRef.current?.stop()
  }, [])

  const reset = useCallback(() => {
    stopTimer()
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    mediaRecorderRef.current = null
    chunksRef.current = []
    setRecordedBlob(null)
    setDurationMs(0)
    setErrorMessage(null)
    setState("idle")
  }, [stopTimer])

  return { state, durationMs, recordedBlob, errorMessage, start, stop, reset }
}
