export interface LocalPlaylistVideo {
  id: string
  title: string
  src: string
  /** Original file name — used to pick MPEG-TS vs native HTML5 playback */
  fileName?: string
}

export interface LocalPlaylistManifest {
  playlistId: string
  videos: LocalPlaylistVideo[]
}
