/**
 * Strips the file extension from a video file name.
 *
 * @param fileName - Raw file name (e.g. Workout-A.mp4)
 */
export const stripVideoExtension = (fileName: string): string =>
  fileName.replace(/\.[^.]+$/, '')

/**
 * Normalizes a video name for matching across admin + client machines.
 * Matching is case-insensitive and ignores file extension.
 *
 * @param fileName - File name or display name
 */
export const normalizeVideoKey = (fileName: string): string =>
  stripVideoExtension(fileName).trim().toLowerCase().replace(/\s+/g, ' ')

/**
 * Returns true when two video names refer to the same file.
 *
 * @param left - First file name
 * @param right - Second file name
 */
export const videoNamesMatch = (left: string, right: string): boolean =>
  normalizeVideoKey(left) === normalizeVideoKey(right)

/**
 * Finds a local file whose name matches an assigned video name.
 *
 * @param assignedName - Name assigned in admin (with or without extension)
 * @param localNames - File names available in the selected folder
 */
export const findMatchingVideoName = (
  assignedName: string,
  localNames: string[],
): string | undefined => localNames.find((name) => videoNamesMatch(name, assignedName))
