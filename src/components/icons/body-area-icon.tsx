import type { CSSProperties } from 'react'

import { BODY_AREA_ICON_SRC } from '@/lib/body-area-icons'
import { cn } from '@/lib/utils'
import type { BodyAreaId } from '@/types/body-area'

type BodyAreaIconProps = {
  area: BodyAreaId
  className?: string
  /** Icon tint for neutral, need (white), or avoid (white) chips */
  tone?: 'neutral' | 'selected'
}

const MASK_STYLE = (src: string): CSSProperties => ({
  WebkitMaskImage: `url(${src})`,
  maskImage: `url(${src})`,
  WebkitMaskRepeat: 'no-repeat',
  maskRepeat: 'no-repeat',
  WebkitMaskPosition: 'center',
  maskPosition: 'center',
  WebkitMaskSize: 'contain',
  maskSize: 'contain',
})

/**
 * Body area icon from user-provided assets (CSS mask for theme-aware tinting).
 * @param area - Body area identifier
 * @param tone - Neutral taupe on white cards, white on selected chips
 */
export const BodyAreaIcon = ({
  area,
  className,
  tone = 'neutral',
}: BodyAreaIconProps) => {
  const src = BODY_AREA_ICON_SRC[area]

  return (
    <span
      role="img"
      aria-hidden
      className={cn(
        'inline-block h-12 w-12 shrink-0',
        tone === 'neutral' ? 'bg-lanta-taupe' : 'bg-white',
        className,
      )}
      style={MASK_STYLE(src)}
    />
  )
}
