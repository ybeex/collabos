'use client'

import { useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Upload, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { workspacesApi } from '@/lib/api-client'
import { parseCsv } from '@/lib/csv'

// PRD_AUDIT.md Finding #9: PRD §14 Flow 1, Quick Import step —
// "Slack/Notion/CSV, skippable." CONTINUATION_PLAN.md scopes this to CSV
// only for a first pass: Slack and Notion each need real OAuth app
// registration and their own API integration, separate and much larger
// work, deferred here explicitly rather than silently under-delivered.
// Expected columns: channel, author email, message, timestamp (optional,
// ISO 8601). Header names are matched case-insensitively so a raw Slack/
// Notion CSV export doesn't need to be manually renamed first.
interface OnboardingImportStepProps {
  workspaceId: string
  onDone: () => void
}

const REQUIRED_COLUMNS = ['channel', 'author email', 'message'] as const

interface ImportSummary {
  channelsCreated: number
  messagesCreated: number
  attributedToOriginalAuthor: number
  attributedToImporter: number
}

export const OnboardingImportStep = ({ workspaceId, onDone }: OnboardingImportStepProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [summary, setSummary] = useState<ImportSummary | null>(null)
  const [pendingRows, setPendingRows] = useState<Array<{ channelName: string; authorEmail: string; content: string; timestamp?: string }> | null>(null)

  const runImport = useMutation({
    mutationFn: (rows: NonNullable<typeof pendingRows>) => workspacesApi.importCsv(workspaceId, rows),
    onSuccess: (result) => setSummary(result as ImportSummary),
    onError: () => setParseError('Import failed. You can try again, or skip and import later from workspace settings.'),
  })

  const handleFile = async (file: File) => {
    setParseError(null)
    setSummary(null)
    setFileName(file.name)

    const text = await file.text()
    const { headers, rows } = parseCsv(text)
    const lowerHeaders = headers.map((h) => h.trim().toLowerCase())

    const missing = REQUIRED_COLUMNS.filter((c) => !lowerHeaders.includes(c))
    if (missing.length > 0) {
      setParseError(`Missing required column(s): ${missing.join(', ')}. Expected: channel, author email, message, timestamp (optional).`)
      setPendingRows(null)
      return
    }

    const channelIdx = lowerHeaders.indexOf('channel')
    const emailIdx = lowerHeaders.indexOf('author email')
    const messageIdx = lowerHeaders.indexOf('message')
    const timestampIdx = lowerHeaders.indexOf('timestamp')

    if (rows.length > 2000) {
      setParseError(`This file has ${rows.length} rows — the import limit is 2,000 per file. Split it and import in batches.`)
      setPendingRows(null)
      return
    }

    const parsed = rows
      .map((r) => ({
        channelName: (r[channelIdx] ?? '').trim(),
        authorEmail: (r[emailIdx] ?? '').trim().toLowerCase(),
        content: (r[messageIdx] ?? '').trim(),
        timestamp: timestampIdx >= 0 && r[timestampIdx]?.trim() ? new Date(r[timestampIdx].trim()).toISOString() : undefined,
      }))
      .filter((r) => r.channelName && r.authorEmail && r.content)

    if (parsed.length === 0) {
      setParseError('No valid rows found — check that channel, author email, and message are filled in for at least one row.')
      setPendingRows(null)
      return
    }

    setPendingRows(parsed)
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-display font-bold text-xl">Import from a CSV</h2>
        <p className="font-mono text-xs text-muted-foreground mt-1">
          Bring in message history from Slack, Notion, or elsewhere. Optional.
        </p>
      </div>

      {parseError && (
        <div className="border border-[var(--color-error)] bg-[var(--color-error-bg)] px-3 py-2">
          <p className="font-mono text-xs text-[var(--color-error)]">{parseError}</p>
        </div>
      )}

      {summary ? (
        <div className="border border-[var(--color-success)] bg-[var(--color-success-bg)] px-3 py-2 flex flex-col gap-1">
          <p className="font-mono text-xs text-[var(--color-success)]">Import complete</p>
          <p className="font-mono text-[10px] text-muted-foreground">
            {summary.messagesCreated} messages into {summary.channelsCreated} new channel{summary.channelsCreated === 1 ? '' : 's'}
            {summary.attributedToImporter > 0 && ` — ${summary.attributedToImporter} attributed to you (no matching account for the original author)`}
          </p>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex flex-col items-center justify-center gap-2 border border-dashed border-border px-4 py-8 hover:bg-muted/30 transition-colors"
        >
          {fileName ? <FileText className="h-6 w-6 text-accent" /> : <Upload className="h-6 w-6 text-muted-foreground" />}
          <p className="font-mono text-xs">{fileName ?? 'Choose a CSV file'}</p>
          <p className="font-mono text-[10px] text-muted-foreground/60">
            Columns: channel, author email, message, timestamp (optional)
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileInputChange}
            className="sr-only"
            aria-label="Choose a CSV file to import"
          />
        </button>
      )}

      <div className="flex items-center gap-2 mt-2">
        {summary ? (
          <Button type="button" className="flex-1" onClick={onDone}>
            Continue
          </Button>
        ) : (
          <>
            <Button
              type="button"
              className="flex-1"
              disabled={!pendingRows || runImport.isPending}
              onClick={() => pendingRows && runImport.mutate(pendingRows)}
            >
              {runImport.isPending ? 'Importing...' : `Import ${pendingRows?.length ?? ''} row${pendingRows?.length === 1 ? '' : 's'}`}
            </Button>
            <Button type="button" variant="ghost" onClick={onDone} disabled={runImport.isPending}>
              Skip
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
