'use client'

/**
 * PRD_AUDIT.md Finding #2: client-side transcript capture using the
 * browser's native Web Speech API. Real limitation, stated plainly:
 * Chromium-based browsers only. Firefox and Safari do not implement
 * SpeechRecognition — callers on those browsers won't have their speech
 * captured, and this hook detects that and reports it.
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import { authedFetch } from '@/lib/api-client'

interface SpeechRecognitionResultLike {
  isFinal: boolean
  0: { transcript: string }
}
interface SpeechRecognitionEventLike extends Event {
  resultIndex: number
  results: ArrayLike<SpeechRecognitionResultLike>
}
interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start: () => void
  stop: () => void
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: Event) => void) | null
  onend: (() => void) | null
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike

const getSpeechRecognitionCtor = (): SpeechRecognitionConstructor | null => {
  if (typeof window === 'undefined') return null
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export const isTranscriptCaptureSupported = (): boolean => getSpeechRecognitionCtor() !== null

interface UseTranscriptCaptureResult {
  supported: boolean
  capturing: boolean
  start: () => void
  stop: () => void
}

export const useTranscriptCapture = (channelId: string): UseTranscriptCaptureResult => {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const [capturing, setCapturing] = useState<boolean>(false)
  const supported = isTranscriptCaptureSupported()

  const sendSegment = useCallback((text: string): void => {
    const trimmed = text.trim()
    if (!trimmed) return
    authedFetch(`/v1/video/${channelId}/transcript`, {
      method: 'POST',
      body: JSON.stringify({ text: trimmed }),
    }).catch(() => {
      // Intentionally silent — a dropped transcript segment shouldn't
      // interrupt the call.
    })
  }, [channelId])

  const start = useCallback((): void => {
    if (!supported || recognitionRef.current) return

    const Ctor = getSpeechRecognitionCtor()
    if (!Ctor) return

    const recognition = new Ctor()
    recognition.continuous = true
    recognition.interimResults = false
    recognition.lang = 'en-US'

    recognition.onresult = (event: SpeechRecognitionEventLike): void => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result?.isFinal) {
          sendSegment(result[0].transcript)
        }
      }
    }

    recognition.onerror = (): void => {
      if (recognitionRef.current) {
        try { recognition.start() } catch { /* already started, ignore */ }
      }
    }

    recognition.onend = (): void => {
      if (recognitionRef.current) {
        try { recognition.start() } catch { /* already started, ignore */ }
      }
    }

    recognitionRef.current = recognition
    recognition.start()
    setCapturing(true)
  }, [supported, sendSegment])

  const stop = useCallback((): void => {
    const recognition = recognitionRef.current
    recognitionRef.current = null
    if (recognition) {
      recognition.onend = null
      recognition.onerror = null
      try { recognition.stop() } catch { /* already stopped, ignore */ }
    }
    setCapturing(false)
  }, [])

  useEffect(() => {
    return (): void => stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { supported, capturing, start, stop }
}
