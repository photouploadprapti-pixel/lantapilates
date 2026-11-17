import { titleFromFileName } from '@/lib/local-video-catalog'

/** Colored pill shown on a gallery thumbnail, matching the catalog badges. */
export type GalleryBadgeTone =
  | 'beginner'
  | 'stretch'
  | 'matwork'
  | 'finisher'
  | 'intermediate'
  | 'cardio'
  | 'athletic'
  | 'intro'

export type GalleryBadge = {
  label: string
  tone: GalleryBadgeTone
}

const BADGE_RULES: readonly { pattern: RegExp; badge: GalleryBadge }[] = [
  { pattern: /\bfinisher\b/i, badge: { label: 'FINISHER', tone: 'finisher' } },
  { pattern: /\bstretch\b/i, badge: { label: 'STRETCH', tone: 'stretch' } },
  { pattern: /\bmat\s*work\b|\bmatwork\b/i, badge: { label: 'MATWORK', tone: 'matwork' } },
  { pattern: /\bcardio\b/i, badge: { label: 'CARDIO', tone: 'cardio' } },
  { pattern: /\bathletic\b/i, badge: { label: 'ATHLETIC', tone: 'athletic' } },
  { pattern: /\bbeginner\b/i, badge: { label: 'BEGINNER', tone: 'beginner' } },
  { pattern: /\bintermediate\b/i, badge: { label: 'INTERMEDIATE', tone: 'intermediate' } },
  { pattern: /\badvanced\b/i, badge: { label: 'ADVANCED', tone: 'intermediate' } },
  { pattern: /\bintro/i, badge: { label: 'INTRO', tone: 'intro' } },
]

/**
 * Picks the catalog-style badge from a file name or title.
 * Specific class words (Stretch, Finisher) win over the level prefix.
 *
 * @param fileName - Hosted or local file name
 * @param title - Optional display title
 */
export const getGalleryBadge = (fileName: string, title = ''): GalleryBadge | null => {
  const source = `${title} ${fileName}`
  for (const rule of BADGE_RULES) {
    if (rule.pattern.test(source)) {
      return rule.badge
    }
  }
  return null
}

/**
 * Builds a short title for a gallery card.
 * Collapses a repeated level word such as "Beginner Beginner Full Body".
 *
 * @param fileNameOrTitle - File name or stored title
 */
export const galleryDisplayTitle = (fileNameOrTitle: string): string => {
  const title = titleFromFileName(fileNameOrTitle)
  return title.replace(/^(Beginner|Intermediate|Advanced)\s+\1\b/i, '$1')
}

/**
 * Formats a clip length as `m:ss` or `h:mm:ss` for the thumbnail badge.
 *
 * @param totalSeconds - Duration reported by the media element
 */
export const formatGalleryDuration = (totalSeconds: number): string => {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
    return ''
  }

  const whole = Math.round(totalSeconds)
  const hours = Math.floor(whole / 3600)
  const minutes = Math.floor((whole % 3600) / 60)
  const seconds = whole % 60

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }

  return `${minutes}:${String(seconds).padStart(2, '0')}`
}
