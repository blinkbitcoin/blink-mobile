import { renderHook } from "@testing-library/react-native"

import useLogout from "@app/hooks/use-logout"
import KeyStoreWrapper from "@app/utils/storage/secureStorage"

const mockReadStoredWalletPresence = jest.fn()

jest.mock("@app/self-custodial/storage/account-index", () => ({
  ...jest.requireActual("@app/self-custodial/storage/account-index"),
  readStoredWalletPresence: () => mockReadStoredWalletPresence(),
}))

/** What the shared presence read answers with. The read itself is unit-tested where it
 *  lives; here it is the dependency this hook applies its own bias to. */
const WalletPresence = {
  Present: "present",
  Absent: "absent",
  Unknown: "unknown",
} as const

const mockClearToken = jest.fn()
const mockResetState = jest.fn()
const mockLogoutMutation = jest.fn()
const mockGetDeviceToken = jest.fn()
const mockAsyncStorage = { multiRemove: jest.fn() }
const mockReportError = jest.fn()

jest.mock("@app/store/persistent-state", () => ({
  usePersistentStateContext: () => ({
    resetState: mockResetState,
    clearToken: mockClearToken,
  }),
}))

jest.mock("@app/graphql/generated", () => ({
  useUserLogoutMutation: () => [mockLogoutMutation],
}))

jest.mock("@app/utils/analytics", () => ({
  logLogout: jest.fn(),
}))

jest.mock("@react-native-firebase/messaging", () => () => ({
  getToken: () => mockGetDeviceToken(),
}))

jest.mock("@app/utils/error-logging", () => ({
  reportError: (...args: unknown[]) => mockReportError(...args),
}))

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { multiRemove: (...args: unknown[]) => mockAsyncStorage.multiRemove(...args) },
}))

jest.mock("@app/utils/storage/secureStorage", () => ({
  __esModule: true,
  default: {
    removeIsBiometricsEnabled: jest.fn(),
    removePin: jest.fn(),
    clearPinFailureState: jest.fn(),
    removeSessionProfiles: jest.fn(),
    removeSessionProfileByToken: jest.fn(),
    getActiveToken: jest.fn(),
  },
}))

const mockedStore = jest.mocked(KeyStoreWrapper)

const logoutOnce = async (
  options?: Parameters<ReturnType<typeof useLogout>["logout"]>[0],
) => {
  const { result } = renderHook(() => useLogout())
  return result.current.logout(options)
}

beforeEach(() => {
  jest.clearAllMocks()
  mockedStore.removeIsBiometricsEnabled.mockResolvedValue(true)
  mockedStore.removePin.mockResolvedValue(true)
  mockedStore.clearPinFailureState.mockResolvedValue(true)
  mockedStore.removeSessionProfiles.mockResolvedValue(true)
  mockedStore.getActiveToken.mockResolvedValue("")
  mockGetDeviceToken.mockResolvedValue("")
  mockAsyncStorage.multiRemove.mockResolvedValue(undefined)
  mockLogoutMutation.mockResolvedValue({ data: {} })
  mockReadStoredWalletPresence.mockResolvedValue(WalletPresence.Absent)
  /** The durable keychain removal reports whether the credential is provably gone. */
  mockClearToken.mockResolvedValue(true)
})

describe("useLogout", () => {
  it("clears the spent attempts along with the PIN itself", async () => {
    // A budget that survives a logout greets the next person to sign in on
    // this device, one typo from being thrown back out.
    await logoutOnce()

    expect(mockedStore.removePin).toHaveBeenCalledTimes(1)
    expect(mockedStore.clearPinFailureState).toHaveBeenCalledTimes(1)
  })

  it("clears it before the state is reset, so nothing races the teardown", async () => {
    await logoutOnce()

    expect(mockedStore.clearPinFailureState.mock.invocationCallOrder[0]).toBeLessThan(
      mockResetState.mock.invocationCallOrder[0],
    )
  })

  it("erases the saved session profiles by default", async () => {
    await logoutOnce()

    expect(mockedStore.removeSessionProfiles).toHaveBeenCalledTimes(1)
  })

  it("keeps everything the device stored when asked to, and still ends the session", async () => {
    // The caller could not read the store, so the list it would erase is the
    // one it never saw. The PIN goes with it: a live token left behind without
    // the lock that guarded it is worse than either alone. Dropping the schema
    // marker would undo the whole thing, since the next boot would read as a
    // fresh install and sweep the profiles anyway.
    await logoutOnce({ preserveStoredCredentials: true })

    expect(mockedStore.removeSessionProfiles).not.toHaveBeenCalled()
    expect(mockedStore.removePin).not.toHaveBeenCalled()
    expect(mockedStore.removeIsBiometricsEnabled).not.toHaveBeenCalled()
    expect(mockedStore.clearPinFailureState).not.toHaveBeenCalled()
    expect(mockAsyncStorage.multiRemove).not.toHaveBeenCalled()
    // The active session still ends.
    expect(mockClearToken).toHaveBeenCalledTimes(1)
    expect(mockResetState).toHaveBeenCalledTimes(1)
  })

  it("drops the keychain token when the session signed out is the active one", async () => {
    mockedStore.getActiveToken.mockResolvedValue("active-token")

    await logoutOnce({ token: "active-token" })

    expect(mockClearToken).toHaveBeenCalledTimes(1)
  })

  it("revokes the session server-side when there is a device token to send", async () => {
    mockGetDeviceToken.mockResolvedValue("device-token")

    await logoutOnce({ token: "active-token" })

    expect(mockLogoutMutation).toHaveBeenCalledWith(
      expect.objectContaining({ variables: { input: { deviceToken: "device-token" } } }),
    )
  })

  it("reports a failed device-token fetch and signs out anyway", async () => {
    mockGetDeviceToken.mockRejectedValue(new Error("messaging unavailable"))

    await logoutOnce({ token: "active-token" })

    expect(mockReportError).toHaveBeenCalledWith(
      "logout device token fetch",
      expect.any(Error),
    )
    expect(mockLogoutMutation).not.toHaveBeenCalled()
    expect(mockResetState).toHaveBeenCalledTimes(1)
  })

  it("gives up on a hanging revocation instead of blocking the sign-out", async () => {
    const consoleDebugSpy = jest.spyOn(console, "debug").mockImplementation(() => {})
    jest.useFakeTimers()
    mockGetDeviceToken.mockResolvedValue("device-token")
    mockLogoutMutation.mockReturnValue(new Promise(() => {}))

    const { result } = renderHook(() => useLogout())
    const signOut = result.current.logout({ token: "active-token" })
    await jest.advanceTimersByTimeAsync(2000)
    await signOut

    expect(mockResetState).toHaveBeenCalledTimes(1)
    jest.useRealTimers()
    consoleDebugSpy.mockRestore()
  })

  it("reports a teardown failure and still resets the state", async () => {
    const consoleDebugSpy = jest.spyOn(console, "debug").mockImplementation(() => {})
    mockedStore.removePin.mockRejectedValue(new Error("keystore locked"))

    await logoutOnce()

    expect(mockReportError).toHaveBeenCalledWith("logout", expect.any(Error))
    expect(mockResetState).toHaveBeenCalledTimes(1)
    consoleDebugSpy.mockRestore()
  })

  it("leaves this device's PIN alone when another session's token is logged out", async () => {
    // The multi-account path drops one stored session; the PIN and its budget
    // belong to the device, not to that session.
    await logoutOnce({ token: "other-session-token" })

    expect(mockedStore.removeSessionProfileByToken).toHaveBeenCalledWith(
      "other-session-token",
    )
    expect(mockedStore.removePin).not.toHaveBeenCalled()
    expect(mockedStore.clearPinFailureState).not.toHaveBeenCalled()
  })

  describe("the app lock, on a device with nothing left for it to guard", () => {
    it("goes with the session, and says so", async () => {
      /** A lock with nothing behind it only locks its owner out: whoever forgot it
       *  signs in again from outside the device and sets a new one. */
      const result = await logoutOnce()

      expect(mockedStore.removePin).toHaveBeenCalledTimes(1)
      expect(mockedStore.clearPinFailureState).toHaveBeenCalledTimes(1)
      expect(mockedStore.removeIsBiometricsEnabled).toHaveBeenCalledTimes(1)
      expect(result).toEqual({ isAppLockKept: false })
    })

    it("goes last, after everything it guards", async () => {
      /** A teardown cut short then leaves a lock in front of what is left, never
       *  what is left with no lock in front of it. */
      await logoutOnce()

      const firstLockErasure =
        mockedStore.removeIsBiometricsEnabled.mock.invocationCallOrder[0]
      expect(mockedStore.removeSessionProfiles.mock.invocationCallOrder[0]).toBeLessThan(
        firstLockErasure,
      )
      expect(mockClearToken.mock.invocationCallOrder[0]).toBeLessThan(firstLockErasure)
    })

    it("is decided before anything is erased", async () => {
      /** Nothing then sits between the erasures for a kill to land on. */
      await logoutOnce()

      expect(mockReadStoredWalletPresence.mock.invocationCallOrder[0]).toBeLessThan(
        mockAsyncStorage.multiRemove.mock.invocationCallOrder[0],
      )
    })

    it("stays when the saved sessions could not be erased, and says so", async () => {
      /** The erasure reports a failure rather than throwing one. A lock dropped
       *  over sessions that are still stored would leave their tokens with
       *  nothing in front of them. */
      mockedStore.removeSessionProfiles.mockResolvedValue(false)

      const result = await logoutOnce()

      expect(mockedStore.removePin).not.toHaveBeenCalled()
      expect(mockedStore.clearPinFailureState).not.toHaveBeenCalled()
      expect(mockedStore.removeIsBiometricsEnabled).not.toHaveBeenCalled()
      expect(result).toEqual({ isAppLockKept: true })
    })

    it("is reported as kept when one of its slots could not be erased", async () => {
      /** A slot that could not be erased is a lock that is still set, and a caller
       *  told otherwise would walk the lock screen away from it. */
      for (const failingSlot of [
        mockedStore.removeIsBiometricsEnabled,
        mockedStore.removePin,
        mockedStore.clearPinFailureState,
      ]) {
        failingSlot.mockResolvedValueOnce(false)

        expect(await logoutOnce()).toEqual({ isAppLockKept: true })
      }
    })

    it("is reported as kept when the teardown fails before it is reached", async () => {
      /** A teardown that threw part-way says nothing about the lock's slots, and a
       *  caller told the lock went would walk a lock screen away from one that
       *  may still be set. */
      const consoleDebugSpy = jest.spyOn(console, "debug").mockImplementation(() => {})
      mockedStore.removeSessionProfiles.mockRejectedValue(new Error("keystore locked"))

      const result = await logoutOnce()

      expect(mockedStore.removePin).not.toHaveBeenCalled()
      expect(result).toEqual({ isAppLockKept: true })
      consoleDebugSpy.mockRestore()
    })

    it("is reported as kept when its own erasure is cut short", async () => {
      const consoleDebugSpy = jest.spyOn(console, "debug").mockImplementation(() => {})
      mockedStore.removePin.mockRejectedValue(new Error("keystore locked"))

      const result = await logoutOnce()

      expect(mockedStore.clearPinFailureState).not.toHaveBeenCalled()
      expect(result).toEqual({ isAppLockKept: true })
      consoleDebugSpy.mockRestore()
    })
  })

  describe("the app lock, on a device that still stores a self-custodial wallet", () => {
    /** No logout erases a stored wallet, and the account switcher opens it
     *  again for whoever holds the phone. The lock is all that stands between
     *  that person and it, so it outlives the session. */
    beforeEach(() => {
      mockReadStoredWalletPresence.mockResolvedValue(WalletPresence.Present)
    })

    it("keeps all three slots the lock is made of, and says so", async () => {
      /** Split any of them and the lock stops working: a PIN without its spent
       *  budget grants a fresh round of guesses, and a PIN without the
       *  biometrics flag routes every later unlock to the keypad. */
      const result = await logoutOnce()

      expect(mockedStore.removePin).not.toHaveBeenCalled()
      expect(mockedStore.clearPinFailureState).not.toHaveBeenCalled()
      expect(mockedStore.removeIsBiometricsEnabled).not.toHaveBeenCalled()
      expect(result).toEqual({ isAppLockKept: true })
    })

    it("still erases everything the session held", async () => {
      await logoutOnce()

      expect(mockedStore.removeSessionProfiles).toHaveBeenCalledTimes(1)
      expect(mockAsyncStorage.multiRemove).toHaveBeenCalledTimes(1)
      expect(mockClearToken).toHaveBeenCalledTimes(1)
      expect(mockResetState).toHaveBeenCalledTimes(1)
    })
  })

  describe("the app lock, when the live credential will not go", () => {
    /**
     * The keychain outlives the app, so a bearer token that could not be erased is one the
     * next launch recovers. Erasing the lock over it would leave that recovery with nothing
     * to answer to, which is the whole reason the removal reports back at all.
     */
    it("keeps all three slots when the active token could not be erased, and says so", async () => {
      mockClearToken.mockResolvedValue(false)

      const result = await logoutOnce()

      expect(mockedStore.removePin).not.toHaveBeenCalled()
      expect(mockedStore.clearPinFailureState).not.toHaveBeenCalled()
      expect(mockedStore.removeIsBiometricsEnabled).not.toHaveBeenCalled()
      expect(result).toEqual({ isAppLockKept: true })
    })

    /** The sessions really were erased, so the teardown is not at fault: it is the one
     *  credential left behind that holds the lock in place. */
    it("keeps the lock even though the saved sessions went", async () => {
      mockedStore.removeSessionProfiles.mockResolvedValue(true)
      mockClearToken.mockResolvedValue(false)

      const result = await logoutOnce()

      expect(mockedStore.removeSessionProfiles).toHaveBeenCalledTimes(1)
      expect(result).toEqual({ isAppLockKept: true })
    })

    it("drops the lock once the token goes with everything else", async () => {
      mockClearToken.mockResolvedValue(true)

      const result = await logoutOnce()

      expect(mockedStore.removePin).toHaveBeenCalledTimes(1)
      expect(result).toEqual({ isAppLockKept: false })
    })
  })

  describe("the app lock, when the device's wallets cannot be counted", () => {
    it("keeps the lock when the account index cannot be read", async () => {
      /** An index that cannot answer is not an index with no wallets. Dropping
       *  the lock on that guess would open whatever the index failed to name. */
      mockReadStoredWalletPresence.mockResolvedValue(WalletPresence.Unknown)

      const result = await logoutOnce()

      expect(mockedStore.removePin).not.toHaveBeenCalled()
      expect(mockedStore.clearPinFailureState).not.toHaveBeenCalled()
      expect(mockedStore.removeIsBiometricsEnabled).not.toHaveBeenCalled()
      expect(result).toEqual({ isAppLockKept: true })
    })
  })

  describe("the app lock, on paths that never erase it", () => {
    it("is kept with the stored credentials, without asking what the device stores", async () => {
      /** The wider option already keeps the lock with everything else, so there
       *  is no decision left for the question to inform. */
      const result = await logoutOnce({ preserveStoredCredentials: true })

      expect(mockReadStoredWalletPresence).not.toHaveBeenCalled()
      expect(mockedStore.removePin).not.toHaveBeenCalled()
      expect(result).toEqual({ isAppLockKept: true })
    })

    it("is kept when a single session's token is logged out, without asking either", async () => {
      const result = await logoutOnce({ token: "other-session-token" })

      expect(mockReadStoredWalletPresence).not.toHaveBeenCalled()
      expect(mockedStore.removePin).not.toHaveBeenCalled()
      expect(result).toEqual({ isAppLockKept: true })
    })
  })
})
