export type TabletSlug = 'tab1' | 'tab2' | 'tab3' | 'tab4'

export const TABLET_SLUGS: TabletSlug[] = ['tab1', 'tab2', 'tab3', 'tab4']

export type TabletUser = {
  id: string
  name: string
  created_at: string
  updated_at: string
}

export type Tablet = {
  slug: TabletSlug
  user_id: string | null
  updated_at: string
}

/** Assigned video for a tablet user (Drive file id or local file name). */
export type UserVideo = {
  id: string
  user_id: string
  /** Drive file id (web) or local file name (legacy / offline cache) */
  file_name: string
  title: string | null
  sort_order: number
  created_at: string
}

export type TabletWithUser = Tablet & {
  user: TabletUser | null
}

export type TabletVideoSource = 'local' | 'drive'

export type TabletSession = {
  slug: TabletSlug
  userName: string
  userId: string
  /** Drive file ids or local file names assigned to this user */
  videoFileNames: string[]
  videoTitles?: string[]
  videoSource?: TabletVideoSource
}

export type DriveCatalogVideo = {
  id: string
  name: string
  mimeType?: string
  size?: string
}

export type AdminUserPayload = {
  id?: string
  name: string
}

export type AdminAssignTabletPayload = {
  slug: TabletSlug
  userId: string | null
}

export type AdminSetVideosPayload = {
  userId: string
  fileNames: string[]
  titles?: string[]
}

export type AdminDeleteVideoPayload = {
  videoId: string
}

export type AdminReorderVideosPayload = {
  userId: string
  videoIds: string[]
}
