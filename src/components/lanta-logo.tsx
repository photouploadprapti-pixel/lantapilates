import Image from 'next/image'

import { cn } from '@/lib/utils'

type LantaLogoProps = {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const sizeClasses = {
  sm: 'max-h-8 w-auto',
  md: 'max-h-12 w-auto',
  lg: 'h-auto w-full max-w-md md:max-w-lg',
  /** Matches Welcome heading scale on TV / remote shells. */
  xl: 'h-auto w-full max-w-xl max-h-[7.5rem] sm:max-h-[9rem]',
} as const

/**
 * Branded Lanta Pilates mark for headers and the welcome screen.
 * @param size - Visual scale preset
 */
export const LantaLogo = ({ size = 'md', className }: LantaLogoProps) => (
  <div className={cn('flex flex-col items-center pb-6 sm:pb-8', className)}>
    <Image
      src="/lanta-pilates-logo.png"
      alt="Lanta Pilates"
      width={748}
      height={325}
      priority={size === 'lg' || size === 'xl'}
      className={cn('object-contain object-center', sizeClasses[size])}
    />
  </div>
)
