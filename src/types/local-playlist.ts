export interface LocalPlaylistVideo {
  id: string
  title: string
  src: string
}

export interface LocalPlaylistManifest {
  playlistId: string
  videos: LocalPlaylistVideo[]
}
