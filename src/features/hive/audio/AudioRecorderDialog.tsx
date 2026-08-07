import { useEffect, useState, type ReactNode } from "react"
import { Circle, Loader2, Mic, RotateCcw, Square, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { useAudioRecorder } from "@/features/hive/audio/useAudioRecorder"
import {
  useDeleteAudioMutation,
  useUploadAudioMutation,
} from "@/features/hive/audio/useTeacherAudio"
import { AudioPlayButton } from "@/features/hive/audio/AudioPlayButton"

interface AudioRecorderDialogProps {
  trigger: ReactNode
  classId: string
  hiveWordId: string
  word: string
  existingAudioPath: string | null
}

/** Teacher-only: record real pronunciation or a practice-sentence
 * reading. Never AI/synthesized speech. */
export function AudioRecorderDialog({
  trigger,
  classId,
  hiveWordId,
  word,
  existingAudioPath,
}: AudioRecorderDialogProps) {
  const [open, setOpen] = useState(false)
  const recorder = useAudioRecorder()
  const uploadAudio = useUploadAudioMutation(classId)
  const deleteAudio = useDeleteAudioMutation(classId)

  useEffect(() => {
    if (!open) recorder.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (recorder.state === "error" && recorder.errorMessage) {
      toast.error("Couldn't access the microphone", { description: recorder.errorMessage })
    }
  }, [recorder.state, recorder.errorMessage])

  async function handleSave() {
    if (!recorder.recordedBlob) return
    try {
      await uploadAudio.mutateAsync({ hiveWordId, blob: recorder.recordedBlob })
      toast.success("Recording saved")
      setOpen(false)
    } catch (error) {
      toast.error("Couldn't save recording", {
        description: error instanceof Error ? error.message : undefined,
      })
    }
  }

  async function handleDelete() {
    try {
      await deleteAudio.mutateAsync({ hiveWordId })
      toast.success("Recording removed")
      setOpen(false)
    } catch (error) {
      toast.error("Couldn't remove recording", {
        description: error instanceof Error ? error.message : undefined,
      })
    }
  }

  const seconds = Math.floor(recorder.durationMs / 1000)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Audio for "{word}"</DialogTitle>
          <DialogDescription>
            Record real pronunciation or a practice sentence -- no synthesized speech.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-4">
          {recorder.state === "idle" && (
            <>
              {existingAudioPath && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <AudioPlayButton path={existingAudioPath} />
                  Current recording
                </div>
              )}
              <Button onClick={recorder.start} size="lg">
                <Mic className="size-4" />
                {existingAudioPath ? "Re-record" : "Record"}
              </Button>
            </>
          )}

          {recorder.state === "requesting" && (
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Loader2 className="size-6 animate-spin" />
              <p className="text-sm">Requesting microphone access…</p>
            </div>
          )}

          {recorder.state === "recording" && (
            <>
              <div className="flex items-center gap-2 text-destructive">
                <Circle className="size-3 animate-pulse fill-current" />
                <span className="font-mono text-lg">
                  {String(Math.floor(seconds / 60)).padStart(2, "0")}:
                  {String(seconds % 60).padStart(2, "0")}
                </span>
              </div>
              <Button onClick={recorder.stop} variant="destructive" size="lg">
                <Square className="size-4" />
                Stop
              </Button>
            </>
          )}

          {recorder.state === "recorded" && recorder.recordedBlob && (
            <>
              <audio controls src={URL.createObjectURL(recorder.recordedBlob)} className="w-full" />
              <div className="flex gap-2">
                <Button variant="outline" onClick={recorder.reset}>
                  <RotateCcw className="size-4" />
                  Re-record
                </Button>
                <Button onClick={handleSave} disabled={uploadAudio.isPending}>
                  {uploadAudio.isPending && <Loader2 className="size-4 animate-spin" />}
                  Save recording
                </Button>
              </div>
            </>
          )}

          {recorder.state === "error" && (
            <Button variant="outline" onClick={recorder.start}>
              <Mic className="size-4" />
              Try again
            </Button>
          )}
        </div>

        {existingAudioPath && recorder.state === "idle" && (
          <DialogFooter>
            <Button
              variant="ghost"
              className="text-destructive"
              onClick={handleDelete}
              disabled={deleteAudio.isPending}
            >
              {deleteAudio.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              Remove recording
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
