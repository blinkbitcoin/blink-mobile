import { renderHook, act } from "@testing-library/react-native"

import type { RecoveryBundleSettings } from "@app/self-custodial/recovery-bundle/settings"

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

let mockBackupAccountId: string | null = null
jest.mock("@app/screens/self-custodial/onboarding/hooks/use-wallet-mnemonic", () => ({
  useBackupAccountId: () => mockBackupAccountId,
}))

const mockReadSettings = jest.fn()
jest.mock("@app/self-custodial/recovery-bundle/settings", () => ({
  readRecoveryBundleSettings: (...args: readonly unknown[]) => mockReadSettings(...args),
}))

const mockReportError = jest.fn()
jest.mock("@app/utils/error-logging", () => ({
  reportError: (...args: readonly unknown[]) => mockReportError(...args),
}))

const setPasswordProtected = (result: {
  current: ReturnType<typeof useCloudBackupForm>
}) => {
  act(() => result.current.toggleEncryption())
  act(() => {
    result.current.setPassword("hunter2hunter2")
    result.current.setConfirmPassword("hunter2hunter2")
  })
}

const flushRead = async () => {
  await act(async () => {
    await Promise.resolve()
  })
}

describe("useCloudBackupForm", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockBackupAccountId = null
  })

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

  describe("recovery-backup cloud sync (D4/D9)", () => {
    it("is off by default and not offered without a password", () => {
      const { result } = renderHook(() => useCloudBackupForm())

      expect(result.current.autoBundleSync).toBe(false)
      // D9: a seed-encrypted bundle must never be stored next to an
      // unencrypted seed, so sync is not on offer until a password exists.
      expect(result.current.canSyncBundle).toBe(false)
    })

    it("becomes available once the seed backup carries a valid password", () => {
      const { result } = renderHook(() => useCloudBackupForm())

      setPasswordProtected(result)

      expect(result.current.canSyncBundle).toBe(true)
    })

    it("can be turned on", () => {
      const { result } = renderHook(() => useCloudBackupForm())

      setPasswordProtected(result)
      act(() => result.current.toggleAutoBundleSync())

      expect(result.current.autoBundleSync).toBe(true)
    })

    it("is cleared when the password is removed again", () => {
      const { result } = renderHook(() => useCloudBackupForm())

      setPasswordProtected(result)
      act(() => result.current.toggleAutoBundleSync())
      expect(result.current.autoBundleSync).toBe(true)

      act(() => result.current.toggleEncryption())

      // Leaving it checked would promise a sync that D9 forbids.
      expect(result.current.autoBundleSync).toBe(false)
      expect(result.current.canSyncBundle).toBe(false)
    })

    /** Reads as off while the gate is shut, so the row never renders a checked
     *  box the user cannot uncheck - the password field is under the keyboard
     *  at that moment. */
    it("reads as off while the password is edited into an invalid state", () => {
      const { result } = renderHook(() => useCloudBackupForm())

      setPasswordProtected(result)
      act(() => result.current.toggleAutoBundleSync())
      expect(result.current.autoBundleSync).toBe(true)

      act(() => result.current.setPassword("short"))

      expect(result.current.canSyncBundle).toBe(false)
      expect(result.current.autoBundleSync).toBe(false)
      // Encryption stays on: the gate closed, not the user's choice to encrypt.
      expect(result.current.isEncrypted).toBe(true)
    })

    it("reads as off while the passwords do not match", () => {
      const { result } = renderHook(() => useCloudBackupForm())

      setPasswordProtected(result)
      act(() => result.current.toggleAutoBundleSync())

      act(() => result.current.setConfirmPassword("hunter2hunter3"))

      expect(result.current.canSyncBundle).toBe(false)
      expect(result.current.autoBundleSync).toBe(false)
    })

    /** Fixing a typo is not withdrawing consent. Discarding the opt-in on a
     *  transient dip would lose it silently, with the checkbox off-screen. */
    it("comes back on once a retyped password is valid again", () => {
      const { result } = renderHook(() => useCloudBackupForm())

      setPasswordProtected(result)
      act(() => result.current.toggleAutoBundleSync())
      act(() => result.current.setPassword("short"))
      expect(result.current.autoBundleSync).toBe(false)

      act(() => result.current.setPassword("hunter2hunter2"))

      expect(result.current.canSyncBundle).toBe(true)
      expect(result.current.autoBundleSync).toBe(true)
    })

    it("toggles twice on a double tap that lands before a re-render", () => {
      const { result } = renderHook(() => useCloudBackupForm())

      act(() => {
        result.current.toggleEncryption()
        result.current.toggleEncryption()
      })

      expect(result.current.isEncrypted).toBe(false)
    })

    /** Turning encryption off is deliberate, so it drops the choice itself -
     *  unlike a password merely being edited. */
    it("stays off after encryption is switched off and on again", () => {
      const { result } = renderHook(() => useCloudBackupForm())

      setPasswordProtected(result)
      act(() => result.current.toggleAutoBundleSync())
      act(() => result.current.toggleEncryption())
      setPasswordProtected(result)

      expect(result.current.canSyncBundle).toBe(true)
      expect(result.current.autoBundleSync).toBe(false)
    })
  })
})

describe("useCloudBackupForm stored sync choice", () => {
  const storedSettings = (cloudSync: boolean): RecoveryBundleSettings => ({
    autoRefresh: true,
    cloudSync,
    exportedAt: null,
  })

  beforeEach(() => {
    jest.clearAllMocks()
    mockBackupAccountId = "account-1"
    mockReadSettings.mockResolvedValue(storedSettings(false))
  })

  it("holds the choice as loading and unknown until the stored one is read", () => {
    mockReadSettings.mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useCloudBackupForm())

    expect(result.current.isAutoBundleSyncLoading).toBe(true)
    expect(result.current.isAutoBundleSyncKnown).toBe(false)
  })

  it("starts from a stored opt-in, so re-entering shows it on again", async () => {
    mockReadSettings.mockResolvedValue(storedSettings(true))
    const { result } = renderHook(() => useCloudBackupForm())
    await flushRead()

    setPasswordProtected(result)

    expect(mockReadSettings).toHaveBeenCalledWith("account-1")
    expect(result.current.isAutoBundleSyncLoading).toBe(false)
    expect(result.current.isAutoBundleSyncKnown).toBe(true)
    expect(result.current.autoBundleSync).toBe(true)
  })

  it("starts off, as a known choice, when nothing was opted into", async () => {
    const { result } = renderHook(() => useCloudBackupForm())
    await flushRead()

    setPasswordProtected(result)

    expect(result.current.isAutoBundleSyncKnown).toBe(true)
    expect(result.current.autoBundleSync).toBe(false)
  })

  it("stays unknown when the stored choice cannot be read, until the user picks one", async () => {
    mockReadSettings.mockRejectedValue(new Error("storage unavailable"))
    const { result } = renderHook(() => useCloudBackupForm())
    await flushRead()
    await flushRead()

    expect(mockReportError).toHaveBeenCalledWith(
      "Recovery bundle settings read",
      expect.any(Error),
    )
    expect(result.current.isAutoBundleSyncLoading).toBe(false)
    expect(result.current.isAutoBundleSyncKnown).toBe(false)

    setPasswordProtected(result)
    act(() => result.current.toggleAutoBundleSync())

    expect(result.current.isAutoBundleSyncKnown).toBe(true)
    expect(result.current.autoBundleSync).toBe(true)
  })

  it("locks the choice again when the backup account only becomes known later", async () => {
    mockBackupAccountId = null
    let resolveRead: (settings: RecoveryBundleSettings) => void = () => {}
    mockReadSettings.mockReturnValue(
      new Promise<RecoveryBundleSettings>((resolve) => {
        resolveRead = resolve
      }),
    )
    const { result, rerender } = renderHook(() => useCloudBackupForm())
    expect(result.current.isAutoBundleSyncLoading).toBe(false)

    // The migration account arrives after the first render.
    mockBackupAccountId = "migration-account-1"
    rerender(undefined)

    expect(result.current.isAutoBundleSyncLoading).toBe(true)
    expect(result.current.isAutoBundleSyncKnown).toBe(false)
    expect(mockReadSettings).toHaveBeenCalledWith("migration-account-1")

    await act(async () => {
      resolveRead(storedSettings(true))
    })
    expect(result.current.isAutoBundleSyncLoading).toBe(false)
    expect(result.current.isAutoBundleSyncKnown).toBe(true)
  })

  it("drops a stored choice that arrives after the form is gone", async () => {
    let resolveRead: (settings: RecoveryBundleSettings) => void = () => {}
    mockReadSettings.mockReturnValue(
      new Promise<RecoveryBundleSettings>((resolve) => {
        resolveRead = resolve
      }),
    )
    const { result, unmount } = renderHook(() => useCloudBackupForm())

    unmount()
    await act(async () => {
      resolveRead(storedSettings(true))
    })

    expect(result.current.isAutoBundleSyncKnown).toBe(false)
    expect(result.current.isAutoBundleSyncLoading).toBe(true)
  })
})
