/** Metadata categories for a pilates video (from the catalog CSV). */
export type VideoCategoryMeta = {
  videoName: string
  accent: string
  paceCategory: string
  wordsPerMinute: number
  equipmentUsed: string[]
  exerciseFocus: string[]
}

/** Words-per-minute range option used in the filter UI. */
export type WpmRangeOption = {
  id: string
  label: string
  min: number
  max: number
}

/** Active multi-select filters for video pickers. */
export type VideoCategoryFiltersState = {
  accents: string[]
  paceCategories: string[]
  wpmRanges: string[]
  equipment: string[]
  exerciseFocus: string[]
}

/** Empty filter state (show all videos). */
export const EMPTY_VIDEO_CATEGORY_FILTERS: VideoCategoryFiltersState = {
  accents: [],
  paceCategories: [],
  wpmRanges: [],
  equipment: [],
  exerciseFocus: [],
}
