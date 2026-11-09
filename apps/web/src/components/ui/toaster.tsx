'use client'

import * as Toast from '@radix-ui/react-toast'
import { X } from 'lucide-react'
import { create } from 'zustand'
import { cn } from '@/lib/utils'

interface ToastItem {
  id: string
  title: string
  description?: string
  variant?: 'default' | 'success' | 'error' | 'warning'
}

interface ToasterStore {
  toasts: ToastItem[]
  add: (toast: Omit<ToastItem, 'id'>) => void
  remove: (id: string) => void
}

export const useToast = create<ToasterStore>((set) => ({
  toasts: [],
  add: (toast) =>
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id: Math.random().toString(36).slice(2) }],
    })),
  remove: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}))

export const toast = {
  success: (title: string, description?: string) =>
    useToast.getState().add({ title, description, variant: 'success' }),
  error: (title: string, description?: string) =>
    useToast.getState().add({ title, description, variant: 'error' }),
  warning: (title: string, description?: string) =>
    useToast.getState().add({ title, description, variant: 'warning' }),
  info: (title: string, description?: string) =>
    useToast.getState().add({ title, description }),
}

const variantClasses = {
  default: 'border-border bg-card text-card-foreground',
  success: 'border-[var(--color-success)] bg-[var(--color-success-bg)] text-[var(--color-success)]',
  error: 'border-[var(--color-error)] bg-[var(--color-error-bg)] text-[var(--color-error)]',
  warning: 'border-[var(--color-warning)] bg-[var(--color-warning-bg)] text-[var(--color-warning)]',
}

export const Toaster = () => {
  const { toasts, remove } = useToast()

  return (
    <Toast.Provider swipeDirection="right" duration={4000}>
      {toasts.map((t) => (
        <Toast.Root
          key={t.id}
          className={cn(
            'group pointer-events-auto relative flex w-full max-w-sm items-start gap-3',
            'rounded border p-4 shadow-lg transition-all',
            'data-[state=open]:animate-slide-up',
            'data-[state=closed]:opacity-0',
            variantClasses[t.variant ?? 'default'],
          )}
          onOpenChange={(open) => { if (!open) remove(t.id) }}
        >
          <div className="flex-1">
            <Toast.Title className="font-mono text-sm font-medium">{t.title}</Toast.Title>
            {t.description && (
              <Toast.Description className="mt-1 font-mono text-xs opacity-80">
                {t.description}
              </Toast.Description>
            )}
          </div>
          <Toast.Close className="opacity-60 hover:opacity-100 transition-opacity">
            <X className="h-4 w-4" />
          </Toast.Close>
        </Toast.Root>
      ))}
      <Toast.Viewport className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-80" />
    </Toast.Provider>
  )
}
