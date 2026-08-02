'use client'

import {
  ACCENT_OPTIONS,
  countActiveVideoCategoryFilters,
  createEmptyVideoCategoryFilters,
  EQUIPMENT_OPTIONS,
  EXERCISE_FOCUS_OPTIONS,
  PACE_CATEGORY_OPTIONS,
  WPM_RANGE_OPTIONS,
} from '@/lib/video-categories'
import { cn } from '@/lib/utils'
import type { VideoCategoryFiltersState } from '@/types/video-category'

type VideoCategoryFiltersProps = {
  filters: VideoCategoryFiltersState
  onChange: (filters: VideoCategoryFiltersState) => void
  /** Compact layout for the offline settings drawer. */
  compact?: boolean
  className?: string
}

type FilterGroupProps = {
  label: string
  options: readonly { value: string; label: string }[]
  selected: string[]
  onToggle: (value: string) => void
  compact?: boolean
}

/**
 * Toggles a value in a string array (add if missing, remove if present).
 *
 * @param values - Current selected values
 * @param value - Value to toggle
 */
const toggleValue = (values: string[], value: string): string[] =>
  values.includes(value) ? values.filter((item) => item !== value) : [...values, value]

/**
 * One filter dimension rendered as selectable chips.
 *
 * @param label - Dimension label
 * @param options - Chip options
 * @param selected - Currently selected values
 * @param onToggle - Toggle callback
 * @param compact - Tighter spacing for drawer use
 */
const FilterGroup = ({
  label,
  options,
  selected,
  onToggle,
  compact = false,
}: FilterGroupProps) => (
  <div className={cn('space-y-2', compact && 'space-y-1.5')}>
    <p className="text-xs font-medium tracking-wide text-lanta-charcoal/60 uppercase">
      {label}
    </p>
    <div className="flex flex-wrap gap-1.5">
      {options.map((option) => {
        const active = selected.includes(option.value)
        return (
          <button
            key={option.value}
            type="button"
            tabIndex={0}
            aria-pressed={active}
            onClick={() => onToggle(option.value)}
            className={cn(
              'rounded-md border px-2.5 py-1.5 text-left text-xs leading-snug transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-lanta-taupe/40',
              'focus-visible:ring-2 focus-visible:ring-lanta-taupe/40',
              active
                ? 'border-lanta-taupe bg-lanta-taupe text-white'
                : 'border-lanta-sand bg-white text-lanta-charcoal hover:border-lanta-taupe/50',
              compact && 'px-2 py-1',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  </div>
)

/**
 * Multi-select category filters for Accent, Pace, WPM, Equipment, and Focus.
 *
 * @param filters - Current filter state
 * @param onChange - Called when any chip selection changes
 * @param compact - Use denser spacing (offline settings)
 * @param className - Optional wrapper class
 */
export const VideoCategoryFilters = ({
  filters,
  onChange,
  compact = false,
  className,
}: VideoCategoryFiltersProps) => {
  const activeCount = countActiveVideoCategoryFilters(filters)

  return (
    <div
      className={cn(
        'space-y-4 rounded-lg border border-lanta-sand bg-white/70 p-3',
        compact && 'space-y-3 p-2.5',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-lanta-charcoal">Filter videos</p>
        {activeCount > 0 ? (
          <button
            type="button"
            tabIndex={0}
            onClick={() => onChange(createEmptyVideoCategoryFilters())}
            className={cn(
              'rounded-md px-2 py-1 text-xs text-lanta-charcoal/70',
              'hover:bg-lanta-cream hover:text-lanta-charcoal',
              'focus:outline-none focus:ring-2 focus:ring-lanta-taupe/40',
            )}
          >
            Clear ({activeCount})
          </button>
        ) : (
          <p className="text-xs text-lanta-charcoal/50">Multi-select</p>
        )}
      </div>

      <FilterGroup
        label="Accent"
        compact={compact}
        selected={filters.accents}
        onToggle={(value) =>
          onChange({ ...filters, accents: toggleValue(filters.accents, value) })
        }
        options={ACCENT_OPTIONS.map((value) => ({ value, label: value }))}
      />

      <FilterGroup
        label="Pace Category"
        compact={compact}
        selected={filters.paceCategories}
        onToggle={(value) =>
          onChange({
            ...filters,
            paceCategories: toggleValue(filters.paceCategories, value),
          })
        }
        options={PACE_CATEGORY_OPTIONS.map((value) => ({ value, label: value }))}
      />

      <FilterGroup
        label="Words Per Minute"
        compact={compact}
        selected={filters.wpmRanges}
        onToggle={(value) =>
          onChange({ ...filters, wpmRanges: toggleValue(filters.wpmRanges, value) })
        }
        options={WPM_RANGE_OPTIONS.map((option) => ({
          value: option.id,
          label: option.label,
        }))}
      />

      <FilterGroup
        label="Equipment Used"
        compact={compact}
        selected={filters.equipment}
        onToggle={(value) =>
          onChange({ ...filters, equipment: toggleValue(filters.equipment, value) })
        }
        options={EQUIPMENT_OPTIONS.map((value) => ({ value, label: value }))}
      />

      <FilterGroup
        label="Exercise Focus"
        compact={compact}
        selected={filters.exerciseFocus}
        onToggle={(value) =>
          onChange({
            ...filters,
            exerciseFocus: toggleValue(filters.exerciseFocus, value),
          })
        }
        options={EXERCISE_FOCUS_OPTIONS.map((value) => ({ value, label: value }))}
      />
    </div>
  )
}
