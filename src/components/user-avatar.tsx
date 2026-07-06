import { cn } from '@/lib/utils'

type UserAvatarProps = {
  name: string
  className?: string
}

/**
 * Circular user avatar with initials derived from the display name.
 * @param name - User's full name shown on the welcome screen
 */
export const UserAvatar = ({ name, className }: UserAvatarProps) => {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')

  return (
    <span
      className={cn(
        'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
        'bg-lanta-sage/20 text-xs font-semibold tracking-wide text-lanta-sage',
        className,
      )}
      aria-hidden="true"
    >
      {initials || (
        <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
        </svg>
      )}
    </span>
  )
}
