'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { Search, MessageSquare, FileText, CheckSquare, Loader2, X, Hash } from 'lucide-react'
import { searchApi } from '@/lib/api-client'
import { useWorkspaceStore } from '@/stores/workspace'
import { cn } from '@/lib/utils'
import * as Dialog from '@radix-ui/react-dialog'

interface SearchResult {
  type: 'message' | 'document' | 'task' | 'canvas'
  id: string
  title: string
  excerpt: string
  url: string
  createdAt: Date
}

interface SearchResponse {
  results: SearchResult[]
  total: number
  query: string
}

interface SearchModalProps {
  open: boolean
  onClose: () => void
}

const TYPE_ICONS = {
  message: MessageSquare,
  document: FileText,
  task: CheckSquare,
  canvas: Hash,
} as const

const TYPE_LABELS = {
  message: 'Message',
  document: 'Document',
  task: 'Task',
  canvas: 'Canvas',
} as const

export const SearchModal = ({ open, onClose }: SearchModalProps) => {
  const router = useRouter()
  const { currentWorkspace } = useWorkspaceStore()
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [selectedIdx, setSelectedIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // Debounce
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300)
    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    if (open) {
      setQuery('')
      setSelectedIdx(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  const { data, isFetching } = useQuery({
    queryKey: ['search', currentWorkspace?.id, debouncedQuery],
    queryFn: () =>
      searchApi.search({ q: debouncedQuery, workspaceId: currentWorkspace?.id ?? '' }) as Promise<SearchResponse>,
    enabled: debouncedQuery.length >= 2 && !!currentWorkspace,
    staleTime: 10_000,
  })

  // Bug fix (found via eslint react-hooks/exhaustive-deps): `data?.results
  // ?? []` created a brand-new array reference every render (even when
  // `data` itself hadn't changed), which meant handleKeyDown's
  // useCallback below — which depends on `results` — never actually
  // stayed memoized across renders, silently defeating the point of
  // wrapping it in useCallback at all. useMemo keyed on the actual
  // results array from the query keeps the reference stable when the
  // underlying data hasn't changed.
  const results = useMemo(() => data?.results ?? [], [data])

  const handleSelect = useCallback((result: SearchResult) => {
    router.push(result.url)
    onClose()
  }, [router, onClose])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIdx((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIdx((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && results[selectedIdx]) {
      handleSelect(results[selectedIdx]!)
    } else if (e.key === 'Escape') {
      onClose()
    }
  }, [results, selectedIdx, handleSelect, onClose])

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50 data-[state=open]:animate-fade-in" />
        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-[15%] -translate-x-1/2 z-50',
            'w-full max-w-2xl bg-card border border-border shadow-2xl',
            'data-[state=open]:animate-slide-down',
          )}
          onKeyDown={handleKeyDown}
        >
          <Dialog.Title className="sr-only">Search workspace</Dialog.Title>

          {/* Search input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
            {isFetching ? (
              <Loader2 className="h-4 w-4 text-muted-foreground animate-spin shrink-0" />
            ) : (
              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            )}
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => { setQuery(e.target.value); setSelectedIdx(0) }}
              placeholder="Search messages, docs, tasks..."
              className="flex-1 bg-transparent font-mono text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
              autoComplete="off"
            />
            {query && (
              <button onClick={() => setQuery('')} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            <kbd className="font-mono text-[10px] bg-muted border border-border px-1.5 py-0.5 text-muted-foreground">ESC</kbd>
          </div>

          {/* Results */}
          <div className="max-h-[480px] overflow-y-auto">
            {query.length < 2 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <Search className="h-8 w-8 text-muted-foreground/30" />
                <p className="font-mono text-xs text-muted-foreground">Type at least 2 characters to search</p>
              </div>
            ) : results.length === 0 && !isFetching ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <p className="font-mono text-sm text-muted-foreground">No results for <strong>&quot;{query}&quot;</strong></p>
                <p className="font-mono text-xs text-muted-foreground/60">Try different keywords or check the spelling</p>
              </div>
            ) : (
              <ul role="listbox">
                {results.map((result, idx) => {
                  const Icon = TYPE_ICONS[result.type] ?? Search
                  return (
                    <li key={result.id} role="option" aria-selected={selectedIdx === idx}>
                      <button
                        onClick={() => handleSelect(result)}
                        onMouseEnter={() => setSelectedIdx(idx)}
                        className={cn(
                          'flex items-start gap-3 w-full px-4 py-3 text-left transition-colors',
                          selectedIdx === idx ? 'bg-accent/10' : 'hover:bg-muted/30',
                        )}
                      >
                        <div className={cn(
                          'flex h-7 w-7 shrink-0 items-center justify-center rounded border',
                          'border-border bg-muted mt-0.5',
                        )}>
                          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-mono text-sm font-medium truncate">{result.title}</span>
                            <span className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-wider shrink-0">
                              {TYPE_LABELS[result.type]}
                            </span>
                          </div>
                          {result.excerpt && (
                            <p className="font-mono text-xs text-muted-foreground truncate">{result.excerpt}</p>
                          )}
                        </div>
                        {selectedIdx === idx && (
                          <kbd className="font-mono text-[10px] bg-muted border border-border px-1.5 py-0.5 text-muted-foreground shrink-0 mt-0.5">
                            Enter
                          </kbd>
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {results.length > 0 && (
            <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-muted/20">
              <span className="font-mono text-[10px] text-muted-foreground/60">
                {results.length} result{results.length !== 1 ? 's' : ''}
              </span>
              <div className="flex items-center gap-3 font-mono text-[10px] text-muted-foreground/60">
                <span><kbd className="bg-muted border border-border px-1">↑↓</kbd> navigate</span>
                <span><kbd className="bg-muted border border-border px-1">Enter</kbd> open</span>
              </div>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
