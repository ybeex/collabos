import * as React from 'react'
import { cn } from '@/lib/utils'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, ...props }, ref) => (
    <div className="w-full">
      <input
        type={type}
        className={cn(
          'flex h-9 w-full border border-border bg-input px-3 py-2 font-mono text-sm text-foreground',
          'placeholder:text-muted-foreground',
          'focus:outline-none focus:border-accent',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'transition-colors duration-150',
          error && 'border-[var(--color-error)]',
          className,
        )}
        ref={ref}
        {...props}
      />
      {error && (
        <p className="mt-1 text-xs text-[var(--color-error)] font-mono">{error}</p>
      )}
    </div>
  ),
)
Input.displayName = 'Input'
