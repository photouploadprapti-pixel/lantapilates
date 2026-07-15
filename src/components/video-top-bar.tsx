import { UserAvatar } from '@/components/user-avatar'
import { cn } from '@/lib/utils'

type VideoTopBarProps = {
  userName: string
  className?: string
}

/**
 * Playback screen header with centered brand title and the signed-in user.
 *
 * @param userName - Name shown on the right side of the bar
 */
export const VideoTopBar = ({ userName, className }: VideoTopBarProps) => (
  <header
    className={cn(
      'relative grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-lanta-sand',
      'bg-lanta-cream px-5 py-3',
      'pt-[max(0.75rem,env(safe-area-inset-top))]',
      className,
    )}
  >
    <div aria-hidden="true" />

    <p className="justify-self-center font-display text-xl tracking-wide text-lanta-taupe sm:text-2xl">
      Lanta Pilates
    </p>

    <div className="flex items-center justify-end gap-3 justify-self-end">
      <span className="max-w-[10rem] truncate text-sm font-medium text-lanta-charcoal sm:max-w-xs">
        {userName}
      </span>
      <UserAvatar name={userName} />
    </div>
  </header>
)
