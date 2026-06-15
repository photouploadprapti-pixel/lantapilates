import type { BodyAreaId } from '@/types/body-area'

/** Where workout video media is loaded from */
export type VideoSourceType = 'google-drive' | 'local'

/** Google Drive shared file reference */
export interface GoogleDriveVideoSource {
  type: 'google-drive'
  fileId: string
  folderId?: string
}

/**
 * Local device storage reference for offline tablet playback.
 * `localPath` will map to on-device files when that mode is enabled.
 */
export interface LocalVideoSource {
  type: 'local'
  localPath: string
}

export type VideoSource = GoogleDriveVideoSource | LocalVideoSource

export interface WorkoutVideo {
  id: string
  title: string
  description?: string
  durationLabel?: string
  /** Body areas this workout targets; used for future filtering */
  targetAreas: BodyAreaId[]
  source: VideoSource
}
