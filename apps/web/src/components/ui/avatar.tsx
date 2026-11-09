import * as React from 'react'
import * as AvatarPrimitive from '@radix-ui/react-avatar'
import { cn, getInitials, generateAvatarColor } from '@/lib/utils'

interface AvatarProps {
  src?: string | null
  name: string
  userId: string
  size?: 'xs' | 'sm' | 'md' | 'lg'
  className?: string
  showPresence?: boolean
  presence?: 'online' | 'away' | 'offline'
}

const sizeClasses = {
  xs: 'h-5 w-5 text-[9px]',
  sm: 'h-7 w-7 text-[11px]',
  md: 'h-9 w-9 text-sm',
  lg: 'h-11 w-11 text-base',
}

const presenceClasses = {
  online: 'bg-[var(--color-success)]',
  away: 'bg-[var(--color-warning)]',
  offline: 'bg-muted-foreground',
}

export const Avatar = ({
  src,
  name,
  userId,
  size = 'md',
  className,
  showPresence,
  presence = 'offline',
}: AvatarProps) => {
  const bgColor = generateAvatarColor(userId)
  const initials = getInitials(name)

  return (
    <div className="relative inline-block">
      <AvatarPrimitive.Root
        className={cn(
          'relative flex shrink-0 overflow-hidden rounded-full',
          sizeClasses[size],
          className,
        )}
      >
        <AvatarPrimitive.Image
          src={src ?? undefined}
          alt={name}
          className="aspect-square h-full w-full object-cover"
        />
        <AvatarPrimitive.Fallback
          className="flex h-full w-full items-center justify-center font-display font-bold text-white"
          style={{ backgroundColor: bgColor }}
        >
          {initials}
        </AvatarPrimitive.Fallback>
      </AvatarPrimitive.Root>

      {showPresence && (
        <span
          className={cn(
            'absolute bottom-0 right-0 block rounded-full border-2 border-background',
            size === 'xs' || size === 'sm' ? 'h-1.5 w-1.5' : 'h-2.5 w-2.5',
            presenceClasses[presence],
          )}
          aria-label={`${name} is ${presence}`}
        />
      )}
    </div>
  )
}
