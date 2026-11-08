'use client'

import { useRef, useState } from 'react'
import { PaperclipIcon, X, FileText, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toaster'
import { cn, formatBytes } from '@/lib/utils'

interface PendingAttachment {
  id: string
  file: File
  preview?: string
  uploading: boolean
  uploadedId?: string
  url?: string
  error?: string
}

interface AttachmentPickerProps {
  workspaceId: string
  onAttachmentsChange: (ids: string[]) => void
}

const ALLOWED_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf', 'text/plain', 'text/markdown',
  'application/zip', 'video/mp4', 'audio/mpeg',
])

export const AttachmentPicker = ({ workspaceId, onAttachmentsChange }: AttachmentPickerProps) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const [attachments, setAttachments] = useState<PendingAttachment[]>([])

  const upload = async (pending: PendingAttachment) => {
    const form = new FormData()
    form.append('file', pending.file)
    form.append('workspaceId', workspaceId)

    try {
      const res = await fetch(
        `${process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'}/v1/upload`,
        { method: 'POST', body: form },
      )
      if (!res.ok) throw new Error('Upload failed')
      const data = await res.json() as { id: string; url: string }

      setAttachments((prev) => {
        const updated = prev.map((a) =>
          a.id === pending.id ? { ...a, uploading: false, uploadedId: data.id, url: data.url } : a,
        )
        onAttachmentsChange(updated.filter((a) => a.uploadedId).map((a) => a.uploadedId!))
        return updated
      })
    } catch {
      setAttachments((prev) => prev.map((a) =>
        a.id === pending.id ? { ...a, uploading: false, error: 'Upload failed' } : a,
      ))
      toast.error('Failed to upload file')
    }
  }

  const handleFiles = (files: FileList | null) => {
    if (!files) return
    const newAttachments: PendingAttachment[] = []
    for (const file of files) {
      if (!ALLOWED_TYPES.has(file.type)) { toast.error(`${file.name}: file type not allowed`); continue }
      if (file.size > 50 * 1024 * 1024) { toast.error(`${file.name}: exceeds 50MB limit`); continue }
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
      const pending: PendingAttachment = {
        id,
        file,
        uploading: true,
        preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
      }
      newAttachments.push(pending)
    }
    if (newAttachments.length === 0) return
    setAttachments((prev) => [...prev, ...newAttachments])
    newAttachments.forEach((a) => upload(a))
  }

  const remove = (id: string) => {
    setAttachments((prev) => {
      const updated = prev.filter((a) => a.id !== id)
      onAttachmentsChange(updated.filter((a) => a.uploadedId).map((a) => a.uploadedId!))
      return updated
    })
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        accept={[...ALLOWED_TYPES].join(',')}
        onChange={(e) => handleFiles(e.target.files)}
      />

      <Button
        variant="ghost"
        size="icon-sm"
        type="button"
        onClick={() => inputRef.current?.click()}
        aria-label="Add attachment"
        className="text-muted-foreground hover:text-foreground"
      >
        <PaperclipIcon className="h-3.5 w-3.5" />
      </Button>

      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2 px-1">
          {attachments.map((a) => (
            <div
              key={a.id}
              className={cn(
                'relative flex items-center gap-2 rounded border px-2 py-1.5 bg-muted',
                a.error ? 'border-[var(--color-error)]' : 'border-border',
              )}
            >
              {a.preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.preview} alt={a.file.name} className="h-8 w-8 rounded object-cover" />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded bg-muted-foreground/10">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
              <div className="flex flex-col">
                <span className="font-mono text-[10px] max-w-[120px] truncate">{a.file.name}</span>
                <span className="font-mono text-[9px] text-muted-foreground">{formatBytes(a.file.size)}</span>
              </div>
              {a.uploading && (
                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground ml-1" />
              )}
              {a.error && (
                <span className="font-mono text-[9px] text-[var(--color-error)]">Failed</span>
              )}
              <button
                type="button"
                onClick={() => remove(a.id)}
                className="ml-1 text-muted-foreground hover:text-foreground transition-colors"
                aria-label={`Remove ${a.file.name}`}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
