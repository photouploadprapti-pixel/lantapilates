import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Merges Tailwind class names with conflict resolution.
 * @param inputs - Class values to combine
 */
export const cn = (...inputs: ClassValue[]): string => twMerge(clsx(inputs))
