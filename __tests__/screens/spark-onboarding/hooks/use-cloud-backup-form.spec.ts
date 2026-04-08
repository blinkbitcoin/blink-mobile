import { renderHook, act } from "@testing-library/react-native"

import { useCloudBackupForm } from "@app/screens/spark-onboarding/hooks/use-cloud-backup-form"

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useFocusEffect: jest.fn(),
}))

jest.mock("@app/utils/validators/password", () => ({
  validatePassword: jest.fn((password: string) => {
    const errors: string[] = []
    if (password.length < 12) errors.push("too-short")
    if (
      !/[A-Z]/.test(password) ||
      !/[0-9]/.test(password) ||
      !/[^a-zA-Z0-9]/.test(password)
    )
      errors.push("too-weak")
    return {
      valid: errors.length === 0,
      errors,
      strength: errors.length === 0 ? "strong" : "weak",
    }
  }),
  PasswordIssue: {
    TooShort: "too-short",
    TooWeak: "too-weak",
    CommonPassword: "common-password",
  },
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      common: {
        passwordTooWeak: () => "Password too weak",
        passwordCommon: () => "Password too common",
      },
      SparkOnboarding: {
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

  it("shows password too short error", () => {
    const { result } = renderHook(() => useCloudBackupForm())

    act(() => result.current.toggleEncryption())
    act(() => result.current.setPassword("short"))

    expect(result.current.passwordError).toBe("Minimum 12 characters")
    expect(result.current.isValid).toBe(false)
  })

  it("shows password mismatch error", () => {
    const { result } = renderHook(() => useCloudBackupForm())

    act(() => result.current.toggleEncryption())
    act(() => result.current.setPassword("ValidPass1234!"))
    act(() => result.current.setConfirmPassword("different"))

    expect(result.current.confirmPasswordError).toBe("Passwords do not match")
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
})
