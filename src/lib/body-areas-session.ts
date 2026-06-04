import type { BodyAreaId, BodyAreasSelection } from '@/types/body-area'

const STORAGE_KEY = 'lanta-pilates-body-areas'

const EMPTY_SELECTION: BodyAreasSelection = { need: [], avoid: [] }

/**
 * Persists body area selections for the current browser tab session.
 * @param selection - Need and avoid area lists
 */
export const saveBodyAreasSession = (selection: BodyAreasSelection): void => {
  if (typeof window === 'undefined') return
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(selection))
}

/**
 * Reads body area selections from the current tab session.
 */
export const loadBodyAreasSession = (): BodyAreasSelection | null => {
  if (typeof window === 'undefined') return null
  const raw = sessionStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!isBodyAreasSelection(parsed)) return null
    return parsed
  } catch {
    return null
  }
}

/**
 * Clears stored body area selections.
 */
export const clearBodyAreasSession = (): void => {
  if (typeof window === 'undefined') return
  sessionStorage.removeItem(STORAGE_KEY)
}

const isBodyAreaId = (value: unknown): value is BodyAreaId => {
  return typeof value === 'string' && BODY_AREA_IDS.has(value)
}

const BODY_AREA_IDS = new Set<string>([
  'shoulders',
  'arms',
  'chest',
  'back',
  'abs',
  'legs',
  'thighs',
])

const isIdArray = (value: unknown): value is BodyAreaId[] => {
  return Array.isArray(value) && value.every(isBodyAreaId)
}

const isBodyAreasSelection = (value: unknown): value is BodyAreasSelection => {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return isIdArray(record.need) && isIdArray(record.avoid)
}

export { EMPTY_SELECTION }
