import type { BodyAreasSelection } from '@/types/body-area'
import type { WorkoutVideo } from '@/types/workout-video'

/**
 * Returns workout videos relevant to the user's body-area selections.
 * Currently returns the full catalog until filtering rules are defined.
 *
 * @param videos - Catalog entries to filter
 * @param selection - User's need/avoid body-area choices from the prior screen
 */
export const filterWorkoutVideos = (
  videos: readonly WorkoutVideo[],
  selection: BodyAreasSelection,
): WorkoutVideo[] => {
  void selection
  return [...videos]
}
