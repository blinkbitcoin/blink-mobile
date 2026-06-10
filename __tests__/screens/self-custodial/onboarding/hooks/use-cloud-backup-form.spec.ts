import { renderHook, act } from "@testing-library/react-native"

import { useCloudBackupForm } from "@app/screens/self-custodial/onboarding/hooks/use-cloud-backup-form"

let mockFocusCleanup: (() => void) | void

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useFocusEffect: (callback: () => (() => void) | void) => {
    mockFocusCleanup = callback()
  },
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      BackupScreen: {
        CloudBackup: {
          passwordTooShort: () => "Minimum 12 characters",
          passwordMismatch: () => "Passwords do not match",
        },
      },
    },
  }),
}))

describe("useCloudBackupForm", () => {
  it("starts with encryption disabled and valid", () => {
    const { result } = renderHook(() => useCloudBackupForm())
    expect(result.current.isEncrypted).toBe(false)
    expect(result.current.isValid).toBe(true)
  })

  it("toggles encryption and clears passwords", () => {
    const { result } = renderHook(() => useCloudBackupForm())

    act(() => result.current.setPassword("test"))
    act(() => result.current.toggleEncryption())

    expect(result.current.isEncrypted).toBe(true)
    expect(result.current.password).toBe("")
  })

  it("is invalid when encryption enabled but no password", () => {
    const { result } = renderHook(() => useCloudBackupForm())

    act(() => result.current.toggleEncryption())

    expect(result.current.isValid).toBe(false)
  })

  it("shows password too short error after the field is marked touched", () => {
    const { result } = renderHook(() => useCloudBackupForm())

    act(() => result.current.toggleEncryption())
    act(() => result.current.setPassword("short"))
    act(() => result.current.markPasswordTouched())

    expect(result.current.passwordError).toBe("Minimum 12 characters")
    expect(result.current.isValid).toBe(false)
  })

  it("does not show password error while typing before the field is touched", () => {
    const { result } = renderHook(() => useCloudBackupForm())

    act(() => result.current.toggleEncryption())
    act(() => result.current.setPassword("short"))

    expect(result.current.passwordError).toBeUndefined()
    expect(result.current.isValid).toBe(false)
  })

  it("resets touched flag when encryption is toggled off", () => {
    const { result } = renderHook(() => useCloudBackupForm())

    act(() => result.current.toggleEncryption())
    act(() => result.current.setPassword("short"))
    act(() => result.current.markPasswordTouched())

    expect(result.current.passwordError).toBe("Minimum 12 characters")

    act(() => result.current.toggleEncryption())
    act(() => result.current.toggleEncryption())
    act(() => result.current.setPassword("shorty"))

    expect(result.current.passwordError).toBeUndefined()
  })

  it("clears password touched flag when the field is emptied", () => {
    const { result } = renderHook(() => useCloudBackupForm())

    act(() => result.current.toggleEncryption())
    act(() => result.current.setPassword("short"))
    act(() => result.current.markPasswordTouched())

    expect(result.current.passwordError).toBe("Minimum 12 characters")

    act(() => result.current.setPassword(""))
    act(() => result.current.setPassword("again"))

    expect(result.current.passwordError).toBeUndefined()
  })

  it("clears confirm-password touched flag when the field is emptied", () => {
    const { result } = renderHook(() => useCloudBackupForm())

    act(() => result.current.toggleEncryption())
    act(() => result.current.setPassword("ValidPass1234!"))
    act(() => result.current.setConfirmPassword("wrong"))
    act(() => result.current.markConfirmPasswordTouched())

    expect(result.current.confirmPasswordError).toBe("Passwords do not match")

    act(() => result.current.setConfirmPassword(""))
    act(() => result.current.setConfirmPassword("s"))

    expect(result.current.confirmPasswordError).toBeUndefined()
  })

  it("shows password mismatch error after confirm field is marked touched", () => {
    const { result } = renderHook(() => useCloudBackupForm())

    act(() => result.current.toggleEncryption())
    act(() => result.current.setPassword("ValidPass1234!"))
    act(() => result.current.setConfirmPassword("different"))
    act(() => result.current.markConfirmPasswordTouched())

    expect(result.current.confirmPasswordError).toBe("Passwords do not match")
    expect(result.current.isValid).toBe(false)
  })

  it("does not show confirm password error while typing before the field is touched", () => {
    const { result } = renderHook(() => useCloudBackupForm())

    act(() => result.current.toggleEncryption())
    act(() => result.current.setPassword("ValidPass1234!"))
    act(() => result.current.setConfirmPassword("different"))

    expect(result.current.confirmPasswordError).toBeUndefined()
    expect(result.current.isValid).toBe(false)
  })

  it("is valid when passwords match and meet minimum length", () => {
    const { result } = renderHook(() => useCloudBackupForm())

    act(() => result.current.toggleEncryption())
    act(() => result.current.setPassword("ValidPass1234!"))
    act(() => result.current.setConfirmPassword("ValidPass1234!"))

    expect(result.current.passwordError).toBeUndefined()
    expect(result.current.confirmPasswordError).toBeUndefined()
    expect(result.current.isValid).toBe(true)
  })

  it("treats a password of exactly 11 characters as too short", () => {
    const { result } = renderHook(() => useCloudBackupForm())

    act(() => result.current.toggleEncryption())
    act(() => result.current.setPassword("12345678901"))
    act(() => result.current.markPasswordTouched())

    expect(result.current.passwordError).toBe("Minimum 12 characters")
    expect(result.current.isValid).toBe(false)
  })

  it("accepts a password of exactly 12 characters", () => {
    const { result } = renderHook(() => useCloudBackupForm())

    act(() => result.current.toggleEncryption())
    act(() => result.current.setPassword("123456789012"))
    act(() => result.current.setConfirmPassword("123456789012"))
    act(() => result.current.markPasswordTouched())

    expect(result.current.passwordError).toBeUndefined()
    expect(result.current.isValid).toBe(true)
  })

  it("clears the confirm-password error once the fields match after being touched", () => {
    const { result } = renderHook(() => useCloudBackupForm())

    act(() => result.current.toggleEncryption())
    act(() => result.current.setPassword("123456789012"))
    act(() => result.current.setConfirmPassword("different"))
    act(() => result.current.markConfirmPasswordTouched())

    expect(result.current.confirmPasswordError).toBe("Passwords do not match")

    act(() => result.current.setConfirmPassword("123456789012"))

    expect(result.current.confirmPasswordError).toBeUndefined()
  })

  it("clears the fields and touched flags when the screen loses focus", () => {
    const { result } = renderHook(() => useCloudBackupForm())

    act(() => result.current.toggleEncryption())
    act(() => result.current.setPassword("123456789012"))
    act(() => result.current.setConfirmPassword("123456789012"))
    act(() => result.current.markPasswordTouched())

    act(() => {
      mockFocusCleanup?.()
    })

    expect(result.current.password).toBe("")
    expect(result.current.confirmPassword).toBe("")
    expect(result.current.passwordError).toBeUndefined()
  })
})
