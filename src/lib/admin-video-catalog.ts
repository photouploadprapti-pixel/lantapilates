import type { LocalVideoFile } from '@/plugins/local-videos/definitions'

const ADMIN_CATALOG_KEY = 'lanta-admin-video-catalog'

export type AdminVideoCatalog = {
  folderName: string
  videos: Array<{ name: string; title: string }>
  updatedAt: string
}

/**
 * Saves the admin-scanned local video catalog (file names only).
 *
 * @param catalog - Folder name and video entries
 */
export const saveAdminVideoCatalog = (catalog: AdminVideoCatalog): void => {
  window.localStorage.setItem(ADMIN_CATALOG_KEY, JSON.stringify(catalog))
}

/**
 * Loads the admin video catalog from local storage.
 */
export const loadAdminVideoCatalog = (): AdminVideoCatalog | null => {
  const raw = window.localStorage.getItem(ADMIN_CATALOG_KEY)
  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw) as AdminVideoCatalog
  } catch {
    return null
  }
}

/**
 * Clears the cached admin catalog.
 */
export const clearAdminVideoCatalog = (): void => {
  window.localStorage.removeItem(ADMIN_CATALOG_KEY)
}

/**
 * Builds an admin catalog from scanned local files.
 *
 * @param folderName - Display name of the selected folder
 * @param files - Video files discovered in the folder
 */
export const catalogFromLocalFiles = (
  folderName: string,
  files: LocalVideoFile[],
): AdminVideoCatalog => ({
  folderName,
  videos: files.map((file) => ({
    name: file.name,
    title: file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim(),
  })),
  updatedAt: new Date().toISOString(),
})
