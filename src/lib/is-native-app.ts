import { Capacitor } from '@capacitor/core'

/**
 * Returns true when running inside a Capacitor native shell (Android/iOS).
 */
export const isNativeApp = (): boolean => Capacitor.isNativePlatform()
