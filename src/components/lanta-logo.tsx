import Image from 'next/image'

import { cn } from '@/lib/utils'

type LantaLogoProps = {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeClasses = {
  sm: 'max-h-8 w-auto',
  md: 'max-h-12 w-auto',
  lg: 'h-auto w-full max-w-xs md:max-w-sm',
} as const

/**
 * Branded Lanta Pilates mark for headers and the welcome screen.
 * @param size - Visual scale preset
 */
export const LantaLogo = ({ size = 'md', className }: LantaLogoProps) => (
  <div className={cn('flex flex-col items-center', className)}>
    <Image
      src="/lanta-pilates-logo.png"
      alt="Lanta Pilates — Reformer & Wellness Space"
      width={640}
      height={256}
      priority={size === 'lg'}
      className={cn('object-contain', sizeClasses[size])}
    />
  </div>
)
