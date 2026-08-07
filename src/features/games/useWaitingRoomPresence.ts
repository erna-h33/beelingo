import { useEffect, useRef, useState } from "react"

import { supabase } from "@/lib/supabase/client"

interface PresenceEntry {
  classStudentId: string
  displayName: string
}

/**
 * Presence is used for exactly one thing in this app (see migration
 * 0021's comment): the waiting-room "who's connected right now" roster.
 * It's a separate concern from the participants-row leaderboard (Postgres
 * Changes, useGameParticipantsQuery) -- a student can have joined (a
 * participants row exists) while their tab is backgrounded/closed, and
 * Presence is what actually reflects "connected right now" for that case.
 *
 * `self` is omitted by students who are only watching (there is no
 * student-only case here, but the teacher console reads this same hook
 * without tracking itself).
 */
export function useWaitingRoomPresence(sessionId: string | undefined, self?: PresenceEntry) {
  const [roster, setRoster] = useState<PresenceEntry[]>([])
  // Read via a ref inside the effect below so `self` (a fresh object each
  // render) doesn't need to be an effect dependency -- resubscribing the
  // channel on every render would thrash the connection for no reason.
  const selfRef = useRef(self)
  selfRef.current = self

  useEffect(() => {
    if (!sessionId) return

    const channel = supabase.channel(`game-waiting-room:${sessionId}`, {
      config: { presence: { key: selfRef.current?.classStudentId ?? crypto.randomUUID() } },
    })

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<PresenceEntry>()
        const entries = Object.values(state)
          .flat()
          .map((p) => ({ classStudentId: p.classStudentId, displayName: p.displayName }))
        setRoster(entries)
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED" && selfRef.current) {
          void channel.track(selfRef.current)
        }
      })

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [sessionId])

  return roster
}
