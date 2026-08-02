import categoryData from '../../shared/pilates-video-categories.json'

import { normalizeVideoKey } from '@/lib/video-name-match'
import type {
  VideoCategoryFiltersState,
  VideoCategoryMeta,
  WpmRangeOption,
} from '@/types/video-category'
import { EMPTY_VIDEO_CATEGORY_FILTERS } from '@/types/video-category'

/** Full category catalog derived from pilates_video_categories.csv. */
export const VIDEO_CATEGORY_CATALOG: readonly VideoCategoryMeta[] =
  categoryData as VideoCategoryMeta[]

/** Accent filter options. */
export const ACCENT_OPTIONS = [
  'American / North American',
  'British',
] as const

/** Pace category filter options. */
export const PACE_CATEGORY_OPTIONS = [
  'Slow / Instructional',
  'Moderate / Balanced',
  'Fast / Energetic',
] as const

/**
 * Words-per-minute buckets for filtering.
 * Ranges are inclusive on min and exclusive on max (except the last).
 */
export const WPM_RANGE_OPTIONS: readonly WpmRangeOption[] = [
  { id: 'under-120', label: 'Under 120', min: 0, max: 120 },
  { id: '120-140', label: '120–140', min: 120, max: 140 },
  { id: '140-160', label: '140–160', min: 140, max: 160 },
  { id: '160-180', label: '160–180', min: 160, max: 180 },
  { id: '180-plus', label: '180+', min: 180, max: Number.POSITIVE_INFINITY },
]

/** Equipment used filter options. */
export const EQUIPMENT_OPTIONS = [
  'Box',
  'Chair / Wunda',
  'Dumbbells / Weights',
  'Magic Circle / Ring',
  'Mat',
  'Mat / Bodyweight Only',
  'Pilates Ball',
  'Reformer',
  'Resistance Band',
] as const

/** Exercise focus filter options. */
export const EXERCISE_FOCUS_OPTIONS = [
  'Core & Abs',
  'Flexibility & Stretch',
  'Glutes & Hips',
  'Legs & Thighs',
  'Upper Body & Arms',
] as const

const categoryByKey = new Map<string, VideoCategoryMeta>(
  VIDEO_CATEGORY_CATALOG.map((entry) => [normalizeVideoKey(entry.videoName), entry]),
)

/**
 * Looks up category metadata for a video file name (.ts / .mp4 / etc.).
 *
 * @param fileName - Local or hosted video file name
 */
export const getVideoCategoryMeta = (fileName: string): VideoCategoryMeta | undefined =>
  categoryByKey.get(normalizeVideoKey(fileName))

/**
 * Returns true when no filters are currently active.
 *
 * @param filters - Current filter state
 */
export const hasActiveVideoCategoryFilters = (
  filters: VideoCategoryFiltersState,
): boolean =>
  filters.accents.length > 0
  || filters.paceCategories.length > 0
  || filters.wpmRanges.length > 0
  || filters.equipment.length > 0
  || filters.exerciseFocus.length > 0

/**
 * Counts how many individual filter chips are selected.
 *
 * @param filters - Current filter state
 */
export const countActiveVideoCategoryFilters = (
  filters: VideoCategoryFiltersState,
): number =>
  filters.accents.length
  + filters.paceCategories.length
  + filters.wpmRanges.length
  + filters.equipment.length
  + filters.exerciseFocus.length

/**
 * Returns true when a WPM value falls in the given range option.
 *
 * @param wpm - Words per minute
 * @param range - Range option
 */
const wpmMatchesRange = (wpm: number, range: WpmRangeOption): boolean => {
  if (range.max === Number.POSITIVE_INFINITY) {
    return wpm >= range.min
  }
  return wpm >= range.min && wpm < range.max
}

/**
 * Returns true when category metadata matches the active multi-filters.
 * Within a dimension: OR. Across dimensions: AND.
 * Videos with no category metadata are hidden when any filter is active.
 *
 * @param meta - Category metadata for a video (or undefined)
 * @param filters - Active filter state
 */
export const videoMetaMatchesFilters = (
  meta: VideoCategoryMeta | undefined,
  filters: VideoCategoryFiltersState,
): boolean => {
  if (!hasActiveVideoCategoryFilters(filters)) {
    return true
  }

  if (!meta) {
    return false
  }

  if (filters.accents.length > 0 && !filters.accents.includes(meta.accent)) {
    return false
  }

  if (
    filters.paceCategories.length > 0
    && !filters.paceCategories.includes(meta.paceCategory)
  ) {
    return false
  }

  if (filters.wpmRanges.length > 0) {
    const matchesWpm = filters.wpmRanges.some((rangeId) => {
      const range = WPM_RANGE_OPTIONS.find((option) => option.id === rangeId)
      return range ? wpmMatchesRange(meta.wordsPerMinute, range) : false
    })
    if (!matchesWpm) {
      return false
    }
  }

  if (
    filters.equipment.length > 0
    && !filters.equipment.some((item) => meta.equipmentUsed.includes(item))
  ) {
    return false
  }

  if (
    filters.exerciseFocus.length > 0
    && !filters.exerciseFocus.some((item) => meta.exerciseFocus.includes(item))
  ) {
    return false
  }

  return true
}

/**
 * Filters a list of items by video file name against category filters.
 *
 * @param items - Items to filter
 * @param getFileName - Extracts the video file name from an item
 * @param filters - Active filter state
 */
export const filterItemsByVideoCategory = <T>(
  items: readonly T[],
  getFileName: (item: T) => string,
  filters: VideoCategoryFiltersState,
): T[] => {
  if (!hasActiveVideoCategoryFilters(filters)) {
    return [...items]
  }

  return items.filter((item) =>
    videoMetaMatchesFilters(getVideoCategoryMeta(getFileName(item)), filters),
  )
}

/**
 * Returns a fresh empty filter state.
 */
export const createEmptyVideoCategoryFilters = (): VideoCategoryFiltersState => ({
  ...EMPTY_VIDEO_CATEGORY_FILTERS,
  accents: [],
  paceCategories: [],
  wpmRanges: [],
  equipment: [],
  exerciseFocus: [],
})
