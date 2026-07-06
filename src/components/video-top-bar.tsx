import { LantaLogo } from '@/components/lanta-logo'
import { UserAvatar } from '@/components/user-avatar'
import { cn } from '@/lib/utils'

type VideoTopBarProps = {
  userName: string
  className?: string
}

/**
 * Playback screen header with brand logo and the signed-in user's name.
 * @param userName - Name entered on the welcome screen
 */
export const VideoTopBar = ({ userName, className }: VideoTopBarProps) => (
  <header
    className={cn(
      'flex items-center justify-between gap-4 border-b border-lanta-sand',
      'bg-lanta-cream px-5 py-4',
      'pt-[max(1rem,env(safe-area-inset-top))]',
      className,
    )}
  >
    <LantaLogo size="sm" className="items-start" />
    <div className="flex items-center gap-3">
      <span className="max-w-[10rem] truncate text-sm font-medium text-lanta-charcoal sm:max-w-xs">
        {userName}
      </span>
      <UserAvatar name={userName} />
    </div>
  </header>
)
