import { clearBodyAreasSession } from '@/lib/body-areas-session'
import { clearProfileSession } from '@/lib/profile-session'

/**
 * Clears all tab session data from the onboarding flow.
 */
export const clearAllAppSession = (): void => {
  clearProfileSession()
  clearBodyAreasSession()
}
