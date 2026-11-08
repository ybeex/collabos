'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'next/navigation'
import { Clock, Share2, MoreHorizontal, Plus, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn, formatRelativeTime, prefersReducedMotion } from '@/lib/utils'
import { authedFetch } from '@/lib/api-client'
import { useDocCrdtSync } from '@/hooks/use-doc-crdt-sync'
import type { Document, DocumentBlock } from '@collabos/shared'

interface DocViewProps {
  workspaceSlug: string
  docId: string
}

export const DocView = ({ docId }: DocViewProps) => {
  const queryClient = useQueryClient()
  const searchParams = useSearchParams()
  // PRD_AUDIT.md Finding #4: PRD §13 specifies
  // /:workspace/docs/:doc-id/block/:block-id as a deep-linkable URL that
  // "preserves... selected block." Implemented as a query param
  // (?block=...) rather than a nested route segment — the page still
  // needs to load the whole document regardless, so a second route
  // duplicating DocPage's data-loading for no benefit would be the wrong
  // shape; a query param the existing route already renders and this
  // component reads is the idiomatic way to express "same page, specific
  // sub-state" in Next.js.
  const targetBlockId = searchParams.get('block')
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)

  const { data: doc, isLoading } = useQuery({
    queryKey: ['doc', docId],
    queryFn: () => authedFetch<Document & { blocks: DocumentBlock[] }>(`/v1/docs/${docId}`),
  })

  const updateTitle = useMutation({
    mutationFn: (title: string) =>
      authedFetch(`/v1/docs/${docId}`, { method: 'PATCH', body: JSON.stringify({ title }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['doc', docId] }),
  })

  // PRD_AUDIT.md Finding #1: block content is now live-synced via Yjs
  // CRDT (use-doc-crdt-sync.ts → WS /v1/ws/doc/:docId), replacing the
  // previous approach of mutating the full block array and PUTting it to
  // /v1/docs/:docId/blocks on every change. That HTTP endpoint still
  // exists as the documented fallback path, but is no longer what powers
  // live editing here — concurrent editors now genuinely merge
  // conflict-free via the shared Y.Doc.
  const { blocks, synced, updateBlockContent, insertBlock, removeBlock } = useDocCrdtSync(
    docId,
    doc?.blocks ?? [],
  )

  // PRD_AUDIT.md Finding #4: once the target block exists in the
  // rendered list (it may not be present on the very first render, since
  // blocks arrive via CRDT sync rather than being guaranteed in the
  // initial HTTP payload), scroll to it and apply a brief highlight —
  // the actual "preserves selected block" behavior the deep link exists
  // to provide, not just a URL that resolves to the right page with no
  // visible effect once there.
  const [highlightedBlockId, setHighlightedBlockId] = useState<string | null>(null)
  const blockRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  useEffect(() => {
    if (!targetBlockId) return
    const el = blockRefs.current.get(targetBlockId)
    if (!el) return
    // PRD_AUDIT.md Finding #8: the global prefers-reduced-motion media
    // query in globals.css can't reach this JS-driven scroll — gated
    // explicitly here instead. See lib/utils.ts.
    el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'center' })
    setHighlightedBlockId(targetBlockId)
    const timer = setTimeout(() => setHighlightedBlockId(null), 2000)
    return () => clearTimeout(timer)
  }, [targetBlockId, blocks.length])

  const handleTitleBlur = () => {
    const text = titleRef.current?.textContent?.trim() ?? ''
    if (text && text !== doc?.title) {
      updateTitle.mutate(text)
    }
  }

  const addBlock = useCallback((afterOrder: number) => {
    const newBlock: DocumentBlock = {
      id: `block-${Date.now()}`,
      documentId: docId,
      type: 'paragraph',
      content: { text: '' },
      order: afterOrder + 0.5,
      parentBlockId: null,
    }
    insertBlock(newBlock)
    setEditingBlockId(newBlock.id)
  }, [docId, insertBlock])

  const updateBlock = useCallback((blockId: string, content: Record<string, unknown>) => {
    updateBlockContent(blockId, content)
  }, [updateBlockContent])

  if (isLoading) {
    return (
      <div className="flex flex-col max-w-3xl mx-auto px-8 py-12 gap-4">
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="h-4 w-32" />
        <div className="mt-8 flex flex-col gap-3">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className={`h-5 w-${i % 2 === 0 ? 'full' : '3/4'}`} />)}
        </div>
      </div>
    )
  }

  if (!doc) return <div className="flex items-center justify-center h-full"><p className="font-mono text-sm text-muted-foreground">Document not found</p></div>

  return (
    <div className="flex h-full flex-col">
      {/* Doc toolbar */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-card px-4 gap-3">
        <div className="flex items-center gap-3 text-xs font-mono text-muted-foreground">
          <span className="flex items-center gap-2">
            <Clock className="h-3 w-3" />
            Last edited {formatRelativeTime(doc.updatedAt)}
          </span>
          <span
            className="flex items-center gap-1.5"
            title={synced ? 'Live collaborative session connected' : 'Connecting to live session...'}
          >
            <span className={cn('h-1.5 w-1.5 rounded-full', synced ? 'bg-[var(--color-success)]' : 'bg-muted-foreground/30 animate-pulse')} />
            <Users className="h-3 w-3" />
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button type="button" title="Share document" variant="ghost" size="icon-sm"><Share2 className="h-3.5 w-3.5" /></Button>
          <Button type="button" title="More options" variant="ghost" size="icon-sm"><MoreHorizontal className="h-3.5 w-3.5" /></Button>
        </div>
      </header>

      {/* Doc content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-8 py-12">
          {/* Title */}
          <h1
            ref={titleRef}
            contentEditable
            suppressContentEditableWarning
            onBlur={handleTitleBlur}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLElement).blur() } }}
            className={cn(
              'font-display font-bold text-4xl tracking-tight outline-none mb-6',
              'empty:before:content-["Untitled"] empty:before:text-muted-foreground/40',
            )}
          >
            {doc.title}
          </h1>

          {/* Blocks — rendered from the CRDT-synced `blocks`, not doc.blocks */}
          <div className="flex flex-col gap-0.5">
            {blocks.map((block) => (
              <div
                key={block.id}
                ref={(el) => {
                  if (el) blockRefs.current.set(block.id, el)
                  else blockRefs.current.delete(block.id)
                }}
                className={cn(
                  'rounded transition-colors duration-500',
                  highlightedBlockId === block.id && 'bg-accent/10 ring-1 ring-accent/30',
                )}
              >
                <BlockEditor
                  block={block}
                  isEditing={editingBlockId === block.id}
                  onFocus={() => setEditingBlockId(block.id)}
                  onBlur={() => setEditingBlockId(null)}
                  onChange={(content) => updateBlock(block.id, content)}
                  onAddAfter={() => addBlock(block.order)}
                  onRemove={() => removeBlock(block.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      addBlock(block.order)
                    }
                  }}
                />
              </div>
            ))}
          </div>

          {/* Add block button */}
          <button
            type="button"
            title="Add a new block"
            onClick={() => addBlock(blocks.length > 0 ? Math.max(...blocks.map((b) => b.order)) : 0)}
            className="flex items-center gap-2 mt-4 text-muted-foreground/40 hover:text-muted-foreground transition-colors font-mono text-sm group"
          >
            <Plus className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
            Click to add a block
          </button>
        </div>
      </div>
    </div>
  )
}

interface BlockEditorProps {
  block: DocumentBlock
  isEditing: boolean
  onFocus: () => void
  onBlur: () => void
  onChange: (content: Record<string, unknown>) => void
  onAddAfter: () => void
  onRemove: () => void
  onKeyDown: (e: React.KeyboardEvent) => void
}

const BLOCK_CLASSES: Record<string, string> = {
  heading1: 'font-display font-bold text-2xl tracking-tight',
  heading2: 'font-display font-bold text-xl tracking-tight',
  heading3: 'font-display font-semibold text-lg',
  paragraph: 'font-mono text-sm leading-relaxed',
  quote: 'font-mono text-sm italic border-l-2 border-accent pl-4 text-muted-foreground',
  code: 'font-mono text-sm bg-muted px-3 py-2 rounded',
  callout: 'font-mono text-sm bg-[var(--color-info-bg)] border border-[var(--color-info)] px-4 py-3 rounded',
  bulleted_list: 'font-mono text-sm leading-relaxed list-disc list-inside',
  numbered_list: 'font-mono text-sm leading-relaxed list-decimal list-inside',
  todo: 'font-mono text-sm flex items-start gap-2',
}

const BlockEditor = ({ block, onFocus, onBlur, onChange, onRemove, onKeyDown }: BlockEditorProps) => {
  const text = (block.content as { text?: string }).text ?? ''
  const className = BLOCK_CLASSES[block.type] ?? BLOCK_CLASSES['paragraph']

  // Backspace on an empty block removes it — standard block-editor
  // convention, and the wiring point for onRemove, which was previously
  // declared on BlockEditorProps and passed down from DocView but never
  // actually called anywhere in this component.
  const handleKeyDownWithRemove = (e: React.KeyboardEvent<HTMLElement>): void => {
    if (e.key === 'Backspace') {
      const currentText = e.currentTarget.textContent ?? ''
      if (currentText.length === 0) {
        e.preventDefault()
        onRemove()
        return
      }
    }
    onKeyDown(e)
  }

  if (block.type === 'todo') {
    const checked = (block.content as { checked?: boolean }).checked ?? false
    return (
      <div className={cn(className, 'flex items-start gap-2 py-0.5')}>
        <input
          type="checkbox"
          title={checked ? 'Mark as not done' : 'Mark as done'}
          checked={checked}
          onChange={(e) => onChange({ ...block.content, checked: e.target.checked })}
          className="mt-0.5 accent-accent"
        />
        <span
          contentEditable
          suppressContentEditableWarning
          onFocus={onFocus}
          onBlur={(e) => { onBlur(); onChange({ ...block.content, text: e.target.textContent ?? '' }) }}
          onKeyDown={handleKeyDownWithRemove}
          className={cn('outline-none flex-1', checked && 'line-through text-muted-foreground')}
        >
          {text}
        </span>
      </div>
    )
  }

  if (block.type === 'divider') {
    return <hr className="border-border my-4" />
  }

  return (
    <div
      contentEditable
      suppressContentEditableWarning
      onFocus={onFocus}
      onBlur={(e) => { onBlur(); onChange({ text: e.target.textContent ?? '' }) }}
      onKeyDown={handleKeyDownWithRemove}
      className={cn(
        'outline-none py-0.5 min-h-[1.5em]',
        'empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground/30',
        className,
      )}
      data-placeholder="Type something..."
    >
      {text}
    </div>
  )
}
