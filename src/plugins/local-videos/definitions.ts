/** A video file discovered in the user-selected folder */
export interface LocalVideoFile {
  id: string
  name: string
  playbackUrl: string
}

export interface HasFolderResult {
  hasFolder: boolean
  folderName?: string
}

export interface PickFolderResult {
  folderName: string
  videoCount: number
}

export interface LocalVideosPlugin {
  hasFolder(): Promise<HasFolderResult>
  pickFolder(): Promise<PickFolderResult>
  listVideos(): Promise<{ videos: LocalVideoFile[] }>
  clearFolder(): Promise<void>
}
