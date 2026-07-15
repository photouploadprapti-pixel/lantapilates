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

/** Assigned local video file for a tablet user (matched by file name offline). */
export type UserVideo = {
  id: string
  user_id: string
  file_name: string
  title: string | null
  sort_order: number
  created_at: string
}

export type TabletWithUser = Tablet & {
  user: TabletUser | null
}

export type TabletSession = {
  slug: TabletSlug
  userName: string
  userId: string
  /** Local video file names assigned to this user */
  videoFileNames: string[]
}

export type AdminUserPayload = {
  id?: string
  name: string
}

export type AdminAssignTabletPayload = {
  slug: TabletSlug
  userId: string | null
}

export type AdminAddVideoPayload = {
  userId: string
  fileName: string
  title?: string
}

export type AdminSetVideosPayload = {
  userId: string
  fileNames: string[]
}

export type AdminDeleteVideoPayload = {
  videoId: string
}

export type AdminReorderVideosPayload = {
  userId: string
  videoIds: string[]
}
