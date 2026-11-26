/** A video file discovered in the user-selected folder */
export interface LocalVideoFile {
  id: string
  name: string
  playbackUrl: string
}

export interface HasFolderResult {
  hasFolder: boolean
  folderName?: string
  /** Absolute filesystem path when known (internal or USB). */
  folderPath?: string
  /** True when the folder is on a removable volume (USB / SD). */
  onRemovable?: boolean
}

export interface PickFolderResult {
  folderName: string
  videoCount: number
  videos?: LocalVideoFile[]
  folderPath?: string
  onRemovable?: boolean
}

export interface LocalVideosPlugin {
  hasFolder(): Promise<HasFolderResult>
  pickFolder(): Promise<PickFolderResult>
  listVideos(): Promise<{
    videos: LocalVideoFile[]
    folderName?: string
    folderPath?: string
    onRemovable?: boolean
  }>
  clearFolder(): Promise<void>
  /**
   * Renames a video file inside the LantaPilates library folder.
   *
   * @param options.fromName - Current file name
   * @param options.toName - New file name (keep the extension)
   */
  renameVideo(options: {
    fromName: string
    toName: string
  }): Promise<{ fromName: string; toName: string; playbackUrl: string }>
  /**
   * Resolves a content:// (or other) URI into a path Capactor WebView / mpegts.js can fetch.
   * Used for MPEG-TS playback on Android.
   */
  resolvePlaybackUrl(options: { uri: string; name?: string }): Promise<{ playbackUrl: string }>
}
