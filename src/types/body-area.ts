/** Identifiers for selectable body focus areas */
export type BodyAreaId =
  | 'shoulders'
  | 'arms'
  | 'chest'
  | 'back'
  | 'abs'
  | 'legs'
  | 'thighs'

export interface BodyAreaDefinition {
  id: BodyAreaId
  label: string
}

export const BODY_AREAS: readonly BodyAreaDefinition[] = [
  { id: 'shoulders', label: 'Shoulders' },
  { id: 'arms', label: 'Arms' },
  { id: 'chest', label: 'Chest' },
  { id: 'back', label: 'Back' },
  { id: 'abs', label: 'Abs' },
  { id: 'legs', label: 'Legs' },
  { id: 'thighs', label: 'Thighs' },
] as const

export interface BodyAreasSelection {
  need: BodyAreaId[]
  avoid: BodyAreaId[]
}
