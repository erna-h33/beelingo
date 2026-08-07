import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { supabase } from "@/lib/supabase/client"

const AUDIO_BUCKET = "teacher-audio"

export function audioPath(classId: string, hiveWordId: string) {
  return `${classId}/${hiveWordId}/audio.webm`
}

/** Signed URL for playback (the bucket is private). Re-fetched whenever
 * the path changes; cached briefly since signed URLs are short-lived. */
export function useSignedAudioUrlQuery(path: string | null) {
  return useQuery({
    queryKey: ["audio-url", path],
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from(AUDIO_BUCKET)
        .createSignedUrl(path as string, 60 * 10)
      if (error) throw error
      return data.signedUrl
    },
    enabled: Boolean(path),
    staleTime: 5 * 60 * 1000,
  })
}

export function useUploadAudioMutation(classId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ hiveWordId, blob }: { hiveWordId: string; blob: Blob }) => {
      const path = audioPath(classId, hiveWordId)
      const { error: uploadError } = await supabase.storage
        .from(AUDIO_BUCKET)
        .upload(path, blob, { upsert: true, contentType: blob.type || "audio/webm" })
      if (uploadError) throw uploadError

      const { error: updateError } = await supabase
        .from("hive_words")
        .update({ teacher_audio_path: path })
        .eq("id", hiveWordId)
      if (updateError) throw updateError

      return path
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classes", classId, "hive"] })
    },
  })
}

export function useDeleteAudioMutation(classId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ hiveWordId }: { hiveWordId: string }) => {
      const path = audioPath(classId, hiveWordId)
      const { error: removeError } = await supabase.storage.from(AUDIO_BUCKET).remove([path])
      if (removeError) throw removeError

      const { error: updateError } = await supabase
        .from("hive_words")
        .update({ teacher_audio_path: null })
        .eq("id", hiveWordId)
      if (updateError) throw updateError
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classes", classId, "hive"] })
    },
  })
}
