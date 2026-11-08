'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Phone, PhoneOff, Mic, MicOff, Video, VideoOff,
  Users, Loader2, AlertCircle, FileText,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar } from '@/components/ui/avatar'
import { toast } from '@/components/ui/toaster'
import { authedFetch } from '@/lib/api-client'
import { useAuthStore } from '@/stores/auth'
import { useTranscriptCapture } from '@/hooks/use-transcript-capture'
import { cn } from '@/lib/utils'

interface Participant {
  userId: string
  name: string
  joinedAt: string
}

interface CallPanelProps {
  channelId: string
  channelName: string
  onClose: () => void
}

type CallState = 'idle' | 'joining' | 'connected' | 'error'

export const CallPanel = ({ channelId, channelName, onClose }: CallPanelProps) => {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const [callState, setCallState] = useState<CallState>('idle')
  const [micMuted, setMicMuted] = useState(false)
  const [videoOff, setVideoOff] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [livekitRoom, setLivekitRoom] = useState<unknown>(null) // LiveKit Room instance
  // Bug fix (found via eslint no-unused-vars, but a real functional gap):
  // RoomEvent and Track were destructured from the livekit-client import
  // below but never used anywhere — the room connected and published the
  // local mic, but never subscribed to remote participants' tracks or
  // played them back. A call where you can't hear anyone else isn't a
  // working call. This ref holds the <audio> elements created for each
  // subscribed remote track so they can be cleaned up on unsubscribe/
  // disconnect.
  const remoteAudioEls = useRef<Map<string, HTMLAudioElement>>(new Map())

  // PRD_AUDIT.md Finding #2: transcript capture, started/stopped
  // alongside the call itself — the PRD's own Flow 4 describes this as
  // silent and automatic, not something the user triggers manually.
  const transcript = useTranscriptCapture(channelId)

  // Poll active participants
  const { data: callData } = useQuery({
    queryKey: ['call-participants', channelId],
    queryFn: () => authedFetch<{ participants: Participant[]; active: boolean }>(
      `/v1/video/${channelId}/participants`,
    ),
    refetchInterval: callState === 'connected' ? 5000 : false,
    enabled: true,
  })

  const joinCall = useMutation({
    mutationFn: () => authedFetch<{ token: string; livekitUrl: string; room: string }>(
      '/v1/video/token',
      { method: 'POST', body: JSON.stringify({ channelId }) },
    ),
    onMutate: () => setCallState('joining'),
    onSuccess: async (data) => {
      try {
        // Dynamically import LiveKit SDK (client-side only). Bug fix
        // (found via a real `tsc` typecheck once livekit-client was
        // actually installed as a dependency — it wasn't declared in
        // package.json at all before this pass, so this path had never
        // been type-checked or run): Room/RoomEvent/Track live in
        // livekit-client itself, not @livekit/components-core (that
        // package exports React hooks/components, not the core SDK
        // classes) — the previous "try components-core, fall back to
        // livekit-client" pattern would always have hit the fallback at
        // runtime, just silently, one broken import behind a caught
        // rejection.
        const { Room, RoomEvent, Track } = await import('livekit-client')

        const room = new Room({
          adaptiveStream: true,
          dynacast: true,
          videoCaptureDefaults: {
            resolution: { width: 640, height: 480, frameRate: 30 },
          },
        })

        // Play back remote participants' audio. Video tracks aren't
        // rendered in this pass (no video grid UI exists yet in this
        // component — participants list is server-polled, not
        // LiveKit-event-driven) but audio is the minimum bar for a call
        // to actually work.
        room.on(RoomEvent.TrackSubscribed, (track, _publication, participant) => {
          if (track.kind !== Track.Kind.Audio) return
          const el = track.attach() as HTMLAudioElement
          el.dataset['participantSid'] = participant.sid
          document.body.appendChild(el)
          remoteAudioEls.current.set(`${participant.sid}:${track.sid}`, el)
        })

        room.on(RoomEvent.TrackUnsubscribed, (track, _publication, participant) => {
          const key = `${participant.sid}:${track.sid}`
          const el = remoteAudioEls.current.get(key)
          if (el) {
            track.detach(el)
            el.remove()
            remoteAudioEls.current.delete(key)
          }
        })

        // Distinguish an unexpected drop (server restart, network loss)
        // from the user explicitly clicking "leave" — leaveCall() already
        // sets callState to 'idle' itself, so only react here when the
        // room is still marked 'connected' at disconnect time.
        room.on(RoomEvent.Disconnected, () => {
          setCallState((prev) => (prev === 'connected' ? 'error' : prev))
          setErrorMessage((prev) => prev || 'Call disconnected unexpectedly')
        })

        // Connect to LiveKit server
        await room.connect(data.livekitUrl, data.token)

        // Enable microphone by default
        await room.localParticipant.setMicrophoneEnabled(true)

        setLivekitRoom(room)
        setCallState('connected')
        queryClient.invalidateQueries({ queryKey: ['call-participants', channelId] })

        // Start transcript capture now that we're actually in the call.
        // No-ops safely on unsupported browsers.
        transcript.start()

        toast.success(`Joined call in #${channelName}`)
      } catch (err) {
        setCallState('error')
        setErrorMessage(err instanceof Error ? err.message : 'Failed to join call')
      }
    },
    onError: (err) => {
      setCallState('error')
      setErrorMessage(err instanceof Error ? err.message : 'Failed to get call token')
    },
  })

  const leaveCall = useCallback(async () => {
    transcript.stop()

    if (livekitRoom) {
      try {
        const room = livekitRoom as { disconnect: () => Promise<void> }
        await room.disconnect()
      } catch {
        // Disconnect errors are non-fatal
      }
    }

    // Clean up any remaining remote audio elements — TrackUnsubscribed
    // normally handles this per-track, but room.disconnect() doesn't
    // reliably fire it for every track on the way out.
    for (const el of remoteAudioEls.current.values()) el.remove()
    remoteAudioEls.current.clear()

    try {
      await authedFetch(`/v1/video/${channelId}/leave`, { method: 'POST' })
    } catch {
      // Leave notification is best-effort
    }

    setLivekitRoom(null)
    setCallState('idle')
    queryClient.invalidateQueries({ queryKey: ['call-participants', channelId] })
    onClose()
  }, [livekitRoom, channelId, queryClient, onClose, transcript])

  const toggleMic = useCallback(async () => {
    if (!livekitRoom) return
    try {
      const room = livekitRoom as { localParticipant: { setMicrophoneEnabled: (e: boolean) => Promise<void> } }
      await room.localParticipant.setMicrophoneEnabled(micMuted)
      setMicMuted((v) => !v)
    } catch {
      toast.error('Failed to toggle microphone')
    }
  }, [livekitRoom, micMuted])

  const toggleVideo = useCallback(async () => {
    if (!livekitRoom) return
    try {
      const room = livekitRoom as { localParticipant: { setCameraEnabled: (e: boolean) => Promise<void> } }
      await room.localParticipant.setCameraEnabled(videoOff)
      setVideoOff((v) => !v)
    } catch {
      toast.error('Failed to toggle camera')
    }
  }, [livekitRoom, videoOff])

  // Auto-leave on unmount
  useEffect(() => {
    // Bug fix (found via eslint react-hooks/exhaustive-deps): captured
    // here, in the effect body, rather than inside the returned cleanup
    // closure below — the rule wants the ref's value read at effect-setup
    // time, not at cleanup time, since a ref's `.current` could in
    // principle have changed by the time cleanup runs. Same Map instance
    // either way in practice (nothing ever reassigns `.current` itself,
    // only mutates the Map in place), but this is the correct, defensive
    // pattern the rule is checking for.
    const audioEls = remoteAudioEls.current
    return () => {
      if (livekitRoom) {
        const room = livekitRoom as { disconnect: () => void }
        room.disconnect()
      }
      for (const el of audioEls.values()) el.remove()
      audioEls.clear()
    }
  }, [livekitRoom])

  const participants = callData?.participants ?? []
  const isActive = callData?.active ?? false

  return (
    <div className="flex flex-col border border-border bg-card rounded overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <Phone className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-mono text-xs font-semibold">#{channelName}</span>
          {isActive && (
            <span className="flex items-center gap-1 font-mono text-[10px] text-[var(--color-success)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-success)] animate-pulse" />
              Live
            </span>
          )}
          {callState === 'connected' && (
            transcript.supported ? (
              <span
                className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground"
                title="This call is being transcribed for an automatic summary"
              >
                <FileText className="h-3 w-3" />
                Transcribing
              </span>
            ) : (
              <span
                className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground/50"
                title="Transcription requires a Chromium-based browser (Chrome, Edge). No transcript will be captured in this session."
              >
                <FileText className="h-3 w-3" />
                No transcript
              </span>
            )
          )}
        </div>
        <div className="flex items-center gap-1">
          <Users className="h-3 w-3 text-muted-foreground" />
          <span className="font-mono text-[10px] text-muted-foreground">{participants.length}</span>
        </div>
      </div>

      {/* Participants list */}
      <div className="flex flex-col gap-1.5 p-3 min-h-[80px]">
        {participants.length === 0 && callState === 'idle' ? (
          <p className="font-mono text-[11px] text-muted-foreground/50 italic text-center py-2">
            No one in the call yet. Start one below.
          </p>
        ) : (
          participants.map((p) => (
            <div key={p.userId} className="flex items-center gap-2">
              {/* Bug fix (found via eslint no-unused-vars): Avatar was
                  imported but never used — this hand-rolled initial-letter
                  circle + separately-positioned online dot duplicates
                  exactly what the shared Avatar component already does
                  (including its showPresence indicator), just without
                  the real per-user avatar image or color-consistent
                  initials used everywhere else in the app. */}
              <Avatar userId={p.userId} name={p.name} size="xs" showPresence presence="online" />
              <span className="font-mono text-xs">
                {p.userId === user?.id ? `${p.name} (you)` : p.name}
              </span>
            </div>
          ))
        )}

        {callState === 'error' && (
          <div className="flex items-start gap-2 text-[var(--color-error)]">
            <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <p className="font-mono text-[10px]">
              {errorMessage || 'Video calling requires the LiveKit server to be running. See ENABLE_VIDEO in .env.'}
            </p>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 px-3 pb-3">
        {callState === 'idle' || callState === 'error' ? (
          <Button
            size="sm"
            variant="accent"
            onClick={() => joinCall.mutate()}
            disabled={joinCall.isPending}
            className="flex-1"
          >
            {joinCall.isPending ? (
              <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Joining...</>
            ) : (
              <><Phone className="h-3.5 w-3.5 mr-1.5" />Join call</>
            )}
          </Button>
        ) : callState === 'joining' ? (
          <Button size="sm" disabled className="flex-1">
            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Connecting...
          </Button>
        ) : (
          <>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={toggleMic}
              aria-label={micMuted ? 'Unmute microphone' : 'Mute microphone'}
              className={cn(micMuted && 'text-[var(--color-error)]')}
            >
              {micMuted ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={toggleVideo}
              aria-label={videoOff ? 'Start video' : 'Stop video'}
              className={cn(videoOff && 'text-[var(--color-error)]')}
            >
              {videoOff ? <VideoOff className="h-3.5 w-3.5" /> : <Video className="h-3.5 w-3.5" />}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={leaveCall}
              className="flex-1"
              aria-label="Leave call"
            >
              <PhoneOff className="h-3.5 w-3.5 mr-1.5" />Leave
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
