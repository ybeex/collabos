'use client'

import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Send, Sparkles, FileText, CheckSquare, MessageSquare, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar } from '@/components/ui/avatar'
import { authedFetch } from '@/lib/api-client'
import { workspacesApi } from '@/lib/api-client'
import { useAuthStore } from '@/stores/auth'
import { cn } from '@/lib/utils'
import type { Workspace } from '@collabos/shared'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  contextUsed?: { messages: number; tasks: number; documents: number }
  isLoading?: boolean
}

interface AIViewProps {
  workspaceSlug: string
}

const SUGGESTION_PROMPTS = [
  'What decisions were made this week?',
  'What tasks are blocked or overdue?',
  'Summarize recent activity in #product',
  'What open questions do we have?',
  'Who is working on what right now?',
] as const

export const AIView = ({ workspaceSlug }: AIViewProps) => {
  const { user } = useAuthStore()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isQuerying, setIsQuerying] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const { data: workspaces } = useQuery({
    queryKey: ['workspaces'],
    queryFn: () => workspacesApi.list() as Promise<Array<{ workspace: Workspace }>>,
  })
  const workspace = workspaces?.find((m) => m.workspace.slug === workspaceSlug)?.workspace

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = async (question: string) => {
    if (!question.trim() || !workspace || isQuerying) return

    const userMsg: ChatMessage = { id: `user-${Date.now()}`, role: 'user', content: question }
    const loadingMsg: ChatMessage = { id: `loading-${Date.now()}`, role: 'assistant', content: '', isLoading: true }

    setMessages((prev) => [...prev, userMsg, loadingMsg])
    setInput('')
    setIsQuerying(true)

    try {
      const res = await authedFetch<{ answer: string; contextUsed: { messages: number; tasks: number; documents: number } }>('/v1/ai/query', {
        method: 'POST',
        body: JSON.stringify({ question, workspaceId: workspace.id }),
      })

      setMessages((prev) =>
        prev.map((m) =>
          m.id === loadingMsg.id
            ? { ...m, content: res.answer, contextUsed: res.contextUsed, isLoading: false }
            : m,
        ),
      )
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === loadingMsg.id
            ? { ...m, content: 'Failed to get a response. Please try again.', isLoading: false }
            : m,
        ),
      )
    } finally {
      setIsQuerying(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-card px-4">
        <Sparkles className="h-4 w-4 text-accent" />
        <span className="font-mono text-sm font-semibold">Intelligence</span>
        <span className="font-mono text-xs text-muted-foreground ml-1">
          — Ask anything about your workspace
        </span>
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-6 max-w-lg mx-auto text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/10 border border-accent/20">
              <Sparkles className="h-6 w-6 text-accent" />
            </div>
            <div>
              <h2 className="font-display font-bold text-xl tracking-tight mb-2">
                Ask about your workspace
              </h2>
              <p className="font-mono text-sm text-muted-foreground">
                CollabOS Intelligence searches across channels, docs, and tasks to answer questions about your team&rsquo;s work.
              </p>
            </div>

            <div className="flex flex-col gap-2 w-full">
              {SUGGESTION_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => handleSubmit(prompt)}
                  className="flex items-center gap-3 px-4 py-3 border border-border rounded hover:border-accent/40 hover:bg-accent/5 text-left transition-colors"
                >
                  <Sparkles className="h-3.5 w-3.5 text-accent/60 shrink-0" />
                  <span className="font-mono text-sm">{prompt}</span>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-3 w-full">
              {[
                { icon: MessageSquare, label: 'Searches messages' },
                { icon: FileText, label: 'Reads documents' },
                { icon: CheckSquare, label: 'Checks tasks' },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="flex flex-col items-center gap-1.5 p-3 border border-border rounded">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span className="font-mono text-[10px] text-muted-foreground text-center">{label}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto flex flex-col gap-4">
            {messages.map((msg) => (
              <ChatBubble key={msg.id} message={msg} user={user} />
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-border bg-card px-4 py-3">
        <div className="max-w-3xl mx-auto">
          <div className={cn(
            'flex items-center gap-2 rounded border border-border bg-input px-3 py-2',
            'focus-within:border-accent transition-colors',
          )}>
            <Sparkles className="h-3.5 w-3.5 text-accent/60 shrink-0" />
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(input) } }}
              placeholder="Ask anything about your workspace..."
              disabled={isQuerying || !workspace}
              className="flex-1 bg-transparent font-mono text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none disabled:opacity-50"
            />
            <Button
              size="icon-sm"
              onClick={() => handleSubmit(input)}
              disabled={!input.trim() || isQuerying || !workspace}
              className={cn(!input.trim() && 'opacity-30')}
            >
              {isQuerying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            </Button>
          </div>
          <p className="mt-1.5 font-mono text-[10px] text-muted-foreground/40 text-center">
            Searches the last 7 days of workspace activity
          </p>
        </div>
      </div>
    </div>
  )
}

interface ChatBubbleProps {
  message: ChatMessage
  user: { id: string; name: string; avatarUrl: string | null } | null
}

const ChatBubble = ({ message, user }: ChatBubbleProps) => {
  if (message.role === 'user') {
    return (
      <div className="flex gap-3 justify-end">
        <div className="max-w-[75%] bg-accent text-accent-foreground rounded px-4 py-3">
          <p className="font-mono text-sm">{message.content}</p>
        </div>
        {user && (
          <Avatar src={user.avatarUrl} name={user.name} userId={user.id} size="sm" className="shrink-0 mt-0.5" />
        )}
      </div>
    )
  }

  return (
    <div className="flex gap-3">
      <div className="h-7 w-7 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0 mt-0.5">
        <Sparkles className="h-3.5 w-3.5 text-accent" />
      </div>
      <div className="flex-1 min-w-0">
        {message.isLoading ? (
          <div className="flex items-center gap-2 py-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
            <span className="font-mono text-xs text-muted-foreground">Searching workspace...</span>
          </div>
        ) : (
          <>
            <div className="bg-card border border-border rounded px-4 py-3">
              <p className="font-mono text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
            </div>
            {message.contextUsed && (
              <div className="flex items-center gap-3 mt-1.5 px-1">
                <span className="font-mono text-[10px] text-muted-foreground/50">Sources searched:</span>
                {message.contextUsed.messages > 0 && <span className="font-mono text-[10px] text-muted-foreground/50">{message.contextUsed.messages} messages</span>}
                {message.contextUsed.tasks > 0 && <span className="font-mono text-[10px] text-muted-foreground/50">{message.contextUsed.tasks} tasks</span>}
                {message.contextUsed.documents > 0 && <span className="font-mono text-[10px] text-muted-foreground/50">{message.contextUsed.documents} docs</span>}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
