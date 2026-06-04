'use client'

import { BodyAreaIcon } from '@/components/icons/body-area-icon'
import { cn } from '@/lib/utils'
import type { BodyAreaId } from '@/types/body-area'

type BodyAreaChipProps = {
  areaId: BodyAreaId
  label: string
  variant: 'neutral' | 'need' | 'avoid'
  onPress: () => void
}

/**
 * Tappable body area tile with icon and selection styling.
 */
export const BodyAreaChip = ({
  areaId,
  label,
  variant,
  onPress,
}: BodyAreaChipProps) => {
  const isSelected = variant === 'need' || variant === 'avoid'

  return (
    <button
      type="button"
      onClick={onPress}
      aria-pressed={isSelected}
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-sm border p-3',
        'min-h-[6.5rem] transition-colors touch-manipulation',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lanta-taupe/40',
        variant === 'neutral'
          && 'border-lanta-sand bg-white text-lanta-charcoal hover:border-lanta-taupe/60',
        variant === 'need'
          && 'border-emerald-600 bg-emerald-600 text-white shadow-sm',
        variant === 'avoid'
          && 'border-red-600 bg-red-600 text-white shadow-sm',
      )}
    >
      <BodyAreaIcon
        area={areaId}
        tone={isSelected ? 'selected' : 'neutral'}
      />
      <span className="text-xs font-medium tracking-wide uppercase">{label}</span>
    </button>
  )
}
