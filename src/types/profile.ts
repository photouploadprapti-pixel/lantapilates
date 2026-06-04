/** User body metrics collected at app start */
export interface UserProfile {
  fullName: string
  age: number
  heightCm: number
  weightKg: number
}

/** Form field values before numeric parsing */
export interface ProfileFormValues {
  fullName: string
  age: string
  heightCm: string
  weightKg: string
}
