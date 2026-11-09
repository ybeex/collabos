import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

// premium-ui-elevation /elevate-ui: adds the active/pressed compression
// (Section 1B) this component never had — every button in the app was
// missing tactile press feedback. `active:scale-95` lives in the base
// string (one shared source, not per-variant) so every filled/outlined/
// ghost/destructive button gets it uniformly; `link` explicitly cancels
// it back to scale-100 (via its own variant string, which cn()'s
// tailwind-merge resolves in favor of since it's declared after the
// base classes) — a bare underlined text link has no button-shaped
// boundary to compress, so scaling it on click reads as a glitch, not
// as "pressable." transition-colors widened to an explicit property
// list that includes transform, since transition-colors and a separate
// transition-transform utility would fight over the same
// transition-property declaration rather than combining.
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap font-mono text-sm font-medium transition-[color,background-color,border-color,transform] duration-150 ease-[var(--ease-out)] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'bg-foreground text-background hover:bg-foreground/90',
        accent:
          'bg-accent text-accent-foreground hover:bg-accent/90',
        outline:
          'border border-border bg-transparent text-foreground hover:bg-muted',
        ghost:
          'bg-transparent text-foreground hover:bg-muted',
        destructive:
          'bg-[var(--color-error)] text-white hover:bg-[var(--color-error)]/90',
        link:
          'text-accent underline-offset-4 hover:underline bg-transparent p-0 h-auto active:scale-100',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-7 px-3 text-xs',
        lg: 'h-11 px-6',
        icon: 'h-9 w-9 p-0',
        'icon-sm': 'h-7 w-7 p-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
    // Bug fix (found empirically while verifying the active:scale-95
    // override above — not something I was looking for): CVA applies
    // `defaultVariants.size: 'default'` whenever a `<Button>` doesn't
    // pass an explicit `size` prop, which concatenates AFTER the
    // `variant` classes — so `variant="link"`'s `h-auto` (meant to let
    // a text link size itself from line-height, not a fixed button
    // height) was always being silently overridden by size's `h-9`
    // whenever size wasn't explicitly set. Confirmed via a standalone
    // script using the real installed cva/tailwind-merge packages, not
    // just reasoning about it. No call site currently uses
    // variant="link" at all, so this had zero visible impact yet — but
    // it would silently break for the first person who does.
    // compoundVariants classes concatenate last, after size, so this is
    // the correct place to make `link` win regardless of size rather
    // than relying on declaration order within the base/variant string.
    // Also re-asserts p-0: size's `px-4 py-2` doesn't get removed by
    // twMerge the way h-9/h-auto did (Tailwind's generated utility
    // order intentionally lets axis-specific px/py override a general
    // p-0's horizontal/vertical sides when combined — that's correct,
    // documented Tailwind behavior, not a conflict-resolution bug), but
    // the net effect was the same: a "zero padding" link variant
    // quietly ending up with real padding from whatever size happened
    // to be active. Same root cause as h-auto, same fix shape.
    compoundVariants: [
      { variant: 'link', class: 'h-auto p-0' },
    ],
  },
)

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp className={cn(buttonVariants({ variant, size }), className)} ref={ref} {...props} />
    )
  },
)
Button.displayName = 'Button'

export { buttonVariants }
