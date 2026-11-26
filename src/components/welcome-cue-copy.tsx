import { cn } from '@/lib/utils'

type WelcomeCueCopyProps = {
  className?: string
}

/**
 * Short movement cue shown immediately above Play on welcome screens.
 *
 * @param className - Optional layout/spacing overrides
 */
export const WelcomeCueCopy = ({ className }: WelcomeCueCopyProps) => (
  <p
    className={cn(
      'text-center text-base leading-snug text-lanta-charcoal/75 sm:text-lg',
      className,
    )}
  >
    Breathe wide • Lengthen your spine • Engage your deep core
  </p>
)
