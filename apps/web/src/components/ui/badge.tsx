import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1 font-mono text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-foreground/10 text-foreground',
        success: 'bg-[var(--color-success-bg)] text-[var(--color-success)]',
        warning: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]',
        error: 'bg-[var(--color-error-bg)] text-[var(--color-error)]',
        info: 'bg-[var(--color-info-bg)] text-[var(--color-info)]',
        accent: 'bg-accent text-accent-foreground',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export const Badge = ({ className, variant, ...props }: BadgeProps) => (
  <span className={cn(badgeVariants({ variant }), className)} {...props} />
)
