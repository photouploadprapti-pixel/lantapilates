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

/** Assigned video for a tablet user (hosted MP4 file name or local file name). */
export type UserVideo = {
  id: string
  user_id: string
  /** Hosted MP4 file name (web) or local file name (offline) */
  file_name: string
  title: string | null
  sort_order: number
  created_at: string
}

export type TabletWithUser = Tablet & {
  user: TabletUser | null
}

export type TabletVideoSource = 'local' | 'hosted' | 'drive'

export type TabletSession = {
  slug: TabletSlug
  userName: string
  userId: string
  /** Hosted MP4 file names or local file names assigned to this user */
  videoFileNames: string[]
  videoTitles?: string[]
  videoSource?: TabletVideoSource
}

export type HostedCatalogVideo = {
  id: string
  name: string
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
