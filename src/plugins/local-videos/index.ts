import { registerPlugin } from '@capacitor/core'

import type { LocalVideosPlugin } from '@/plugins/local-videos/definitions'

/**
 * Native bridge for offline folder-based video storage on Android.
 */
export const LocalVideos = registerPlugin<LocalVideosPlugin>('LocalVideos')
