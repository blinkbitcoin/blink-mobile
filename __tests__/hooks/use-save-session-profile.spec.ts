import { renderHook } from "@testing-library/react-native"

import { DefaultAccountId } from "@app/types/wallet"

import { useSaveSessionProfile } from "@app/hooks/use-save-session-profile"

const mockSaveToken = jest.fn()
const mockUpdateState = jest.fn()
const mockFetchUsername = jest.fn()
const mockReadSessionProfiles = jest.fn()
const mockSaveSessionProfiles = jest.fn()
const mockResetUpgradeModal = jest.fn()
const mockUpdateDeviceSessionCount = jest.fn()
const mockRecordError = jest.fn()

jest.mock("@apollo/client", () => ({
  ...jest.requireActual("@apollo/client"),
  useApolloClient: () => ({}),
}))

jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useGetUsernamesLazyQuery: () => [mockFetchUsername],
}))

jest.mock("@app/graphql/client-only-query", () => ({
  updateDeviceSessionCount: (...args: unknown[]) => mockUpdateDeviceSessionCount(...args),
}))

jest.mock("@app/store/persistent-state", () => ({
  usePersistentStateContext: () => ({ updateState: mockUpdateState }),
}))

jest.mock("@app/hooks/use-app-config", () => ({
  useAppConfig: () => ({
    saveToken: mockSaveToken,
    appConfig: {
      token: "current-token",
      galoyInstance: { lnAddressHostname: "blink.sv" },
    },
  }),
}))

jest.mock("@app/hooks/use-show-upgrade-modal", () => ({
  useAutoShowUpgradeModal: () => ({ resetUpgradeModal: mockResetUpgradeModal }),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({ LL: { common: { blinkUser: () => "Blink user" } } }),
}))

jest.mock("@app/utils/storage/secureStorage", () => ({
  __esModule: true,
  default: {
    readSessionProfiles: (...args: unknown[]) => mockReadSessionProfiles(...args),
    saveSessionProfiles: (...args: unknown[]) => mockSaveSessionProfiles(...args),
  },
}))

jest.mock("@react-native-firebase/crashlytics", () => () => ({
  recordError: (...args: unknown[]) => mockRecordError(...args),
  log: jest.fn(),
}))

const setUserMe = (me: {
  id: string
  username?: string | null
  phone?: string | null
  email?: { address: string } | null
  defaultAccount: { id: string } | null
}) => {
  mockFetchUsername.mockResolvedValue({ data: { me } })
}

const storeProfiles = (profiles: unknown[]) => {
  mockReadSessionProfiles.mockResolvedValue({ status: "found", profiles })
}

describe("useSaveSessionProfile", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSaveToken.mockResolvedValue(undefined)
    storeProfiles([])
    mockSaveSessionProfiles.mockResolvedValue(true)
  })

  describe("saveProfile", () => {
    it("returns without writing when token is empty", async () => {
      const { result } = renderHook(() => useSaveSessionProfile())

      await result.current.saveProfile("")

      expect(mockSaveToken).not.toHaveBeenCalled()
      expect(mockUpdateState).not.toHaveBeenCalled()
      expect(mockReadSessionProfiles).not.toHaveBeenCalled()
    })

    it("writes activeAccountId = DefaultAccountId.Custodial after saving the token", async () => {
      setUserMe({ id: "u1", username: "alice", defaultAccount: { id: "acct-1" } })

      const { result } = renderHook(() => useSaveSessionProfile())

      await result.current.saveProfile("new-token")

      expect(mockSaveToken).toHaveBeenCalledWith("new-token")
      expect(mockUpdateState).toHaveBeenCalledTimes(1)

      const updater = mockUpdateState.mock.calls[0][0]
      expect(updater(null)).toBeNull()
      expect(updater({ galoyAuthToken: "x" })).toEqual({
        galoyAuthToken: "x",
        activeAccountId: DefaultAccountId.Custodial,
      })
    })

    it("flips activeAccountId to Custodial even when the previously-active was a self-custodial account", async () => {
      setUserMe({ id: "u1", username: "alice", defaultAccount: { id: "acct-1" } })

      const { result } = renderHook(() => useSaveSessionProfile())

      await result.current.saveProfile("new-token")

      const updater = mockUpdateState.mock.calls[0][0]
      const next = updater({
        galoyAuthToken: "x",
        activeAccountId: "self-custodial-uuid",
      })
      expect(next.activeAccountId).toBe(DefaultAccountId.Custodial)
    })

    it("calls saveToken BEFORE updateState so the auth context propagates first", async () => {
      setUserMe({ id: "u1", username: "alice", defaultAccount: { id: "acct-1" } })

      const { result } = renderHook(() => useSaveSessionProfile())

      await result.current.saveProfile("new-token")

      const saveTokenOrder = mockSaveToken.mock.invocationCallOrder[0]
      const updateStateOrder = mockUpdateState.mock.invocationCallOrder[0]

      expect(saveTokenOrder).toBeLessThan(updateStateOrder)
    })

    it("calls updateState BEFORE the profile fetch so an self-custodial-active user lands on Custodial even if /me fails", async () => {
      mockFetchUsername.mockRejectedValue(new Error("network down"))

      const { result } = renderHook(() => useSaveSessionProfile())

      await result.current.saveProfile("new-token")

      expect(mockUpdateState).toHaveBeenCalledTimes(1)
      const updater = mockUpdateState.mock.calls[0][0]
      expect(updater({ galoyAuthToken: "x" }).activeAccountId).toBe(
        DefaultAccountId.Custodial,
      )
    })

    it("returns early without saving the new profile when the token is already stored", async () => {
      storeProfiles([{ token: "existing-token", accountId: "acct-1", selected: true }])

      const { result } = renderHook(() => useSaveSessionProfile())

      await result.current.saveProfile("existing-token")

      expect(mockUpdateState).toHaveBeenCalledTimes(1)
      expect(mockFetchUsername).not.toHaveBeenCalled()
      expect(mockSaveSessionProfiles).not.toHaveBeenCalled()
    })

    it("still persists the profile when /me is temporarily missing defaultAccount", async () => {
      // A fresh device account has no username/phone/email, so the identifier
      // falls back to the defaultAccount id — which can lag right after creation
      setUserMe({ id: "u1", defaultAccount: null })

      const { result } = renderHook(() => useSaveSessionProfile())

      await result.current.saveProfile("new-token")

      expect(mockRecordError).not.toHaveBeenCalled()
      expect(mockSaveSessionProfiles).toHaveBeenCalledTimes(1)
      const saved = mockSaveSessionProfiles.mock.calls[0][0]
      expect(saved).toHaveLength(1)
      expect(saved[0].identifier).toBe("Blink user")
      // transitional state — backfilled by the next login or profile update,
      // covered by the two healing tests below
      expect(saved[0].accountId).toBeUndefined()
      expect(saved[0].selected).toBe(true)
    })

    it("re-fetches and replaces a degraded profile (no accountId) instead of returning early", async () => {
      setUserMe({ id: "u1", username: "alice", defaultAccount: { id: "acct-1" } })
      storeProfiles([{ token: "new-token", identifier: "Blink user", selected: true }])

      const { result } = renderHook(() => useSaveSessionProfile())

      await result.current.saveProfile("new-token")

      expect(mockSaveSessionProfiles).toHaveBeenCalledTimes(1)
      const saved = mockSaveSessionProfiles.mock.calls[0][0]
      expect(saved).toHaveLength(1)
      expect(saved[0].accountId).toBe("acct-1")
      expect(saved[0].identifier).toBe("alice")
      expect(saved[0].selected).toBe(true)
    })

    it("saves a brand-new profile alongside the deselected previous ones", async () => {
      setUserMe({ id: "u1", username: "alice", defaultAccount: { id: "acct-new" } })
      storeProfiles([{ token: "old-token", accountId: "acct-old", selected: true }])

      const { result } = renderHook(() => useSaveSessionProfile())

      await result.current.saveProfile("new-token")

      expect(mockSaveSessionProfiles).toHaveBeenCalledTimes(1)
      const saved = mockSaveSessionProfiles.mock.calls[0][0]
      expect(saved).toHaveLength(2)
      expect(saved[0].accountId).toBe("acct-new")
      expect(saved[0].selected).toBe(true)
      expect(saved[1].accountId).toBe("acct-old")
      expect(saved[1].selected).toBe(false)
    })

    it("re-selects the existing profile when the user signs in again with a fresh token", async () => {
      setUserMe({ id: "u1", username: "alice", defaultAccount: { id: "acct-existing" } })
      storeProfiles([
        { token: "stale-token", accountId: "acct-existing", selected: false },
        { token: "other-token", accountId: "acct-other", selected: true },
      ])

      const { result } = renderHook(() => useSaveSessionProfile())

      await result.current.saveProfile("fresh-token")

      const saved = mockSaveSessionProfiles.mock.calls[0][0]
      const existing = saved.find(
        (p: { accountId: string }) => p.accountId === "acct-existing",
      )
      const other = saved.find((p: { accountId: string }) => p.accountId === "acct-other")

      expect(existing.selected).toBe(true)
      expect(existing.token).toBe("fresh-token")
      expect(other.selected).toBe(false)
    })

    it("writes nothing when the profiles read fails, so the other sessions survive", async () => {
      setUserMe({ id: "u1", username: "alice", defaultAccount: { id: "acct-new" } })
      mockReadSessionProfiles.mockResolvedValue({
        status: "failed",
        err: new Error("keystore locked"),
      })

      const { result } = renderHook(() => useSaveSessionProfile())

      await result.current.saveProfile("new-token")

      expect(mockSaveSessionProfiles).not.toHaveBeenCalled()
      expect(mockRecordError).toHaveBeenCalledTimes(1)
      // The login itself still stands: only the profile list is left alone
      expect(mockSaveToken).toHaveBeenCalledWith("new-token")
      // and its own side effects run, since they belong to the login
      expect(mockResetUpgradeModal).toHaveBeenCalledTimes(1)
      expect(mockUpdateDeviceSessionCount).toHaveBeenCalledWith(expect.anything(), {
        reset: true,
      })
    })

    it("writes nothing when /me resolves without a user", async () => {
      mockFetchUsername.mockResolvedValue({ data: { me: null } })

      const { result } = renderHook(() => useSaveSessionProfile())

      await result.current.saveProfile("new-token")

      expect(mockSaveSessionProfiles).not.toHaveBeenCalled()
    })

    it("saves the first profile when nothing is stored yet", async () => {
      setUserMe({ id: "u1", username: "alice", defaultAccount: { id: "acct-new" } })
      mockReadSessionProfiles.mockResolvedValue({ status: "absent" })

      const { result } = renderHook(() => useSaveSessionProfile())

      await result.current.saveProfile("new-token")

      expect(mockSaveSessionProfiles).toHaveBeenCalledTimes(1)
      const saved = mockSaveSessionProfiles.mock.calls[0][0]
      expect(saved).toHaveLength(1)
      expect(saved[0].accountId).toBe("acct-new")
    })
  })

  describe("updateCurrentProfile", () => {
    it("heals a degraded profile by token match once defaultAccount resolves", async () => {
      setUserMe({ id: "u1", username: "alice", defaultAccount: { id: "acct-1" } })
      storeProfiles([
        { token: "current-token", identifier: "Blink user", selected: true },
      ])

      const { result } = renderHook(() => useSaveSessionProfile())

      await result.current.updateCurrentProfile()

      expect(mockSaveSessionProfiles).toHaveBeenCalledTimes(1)
      const saved = mockSaveSessionProfiles.mock.calls[0][0]
      expect(saved).toHaveLength(1)
      expect(saved[0].accountId).toBe("acct-1")
      expect(saved[0].identifier).toBe("alice")
    })

    it("leaves a profile that matches neither the account nor the token untouched", async () => {
      setUserMe({ id: "u1", username: "alice", defaultAccount: { id: "acct-1" } })
      const other = { token: "other-token", accountId: "acct-other", selected: false }
      storeProfiles([other])

      const { result } = renderHook(() => useSaveSessionProfile())

      await result.current.updateCurrentProfile()

      expect(mockSaveSessionProfiles).toHaveBeenCalledWith([other])
    })

    it("writes nothing when the current profile cannot be fetched", async () => {
      mockFetchUsername.mockResolvedValue({ data: { me: null } })
      storeProfiles([{ token: "current-token", accountId: "acct-1", selected: true }])

      const { result } = renderHook(() => useSaveSessionProfile())

      await result.current.updateCurrentProfile()

      expect(mockSaveSessionProfiles).not.toHaveBeenCalled()
    })

    it("writes nothing when the profiles read fails, so the other sessions survive", async () => {
      setUserMe({ id: "u1", username: "alice", defaultAccount: { id: "acct-1" } })
      mockReadSessionProfiles.mockResolvedValue({
        status: "failed",
        err: new Error("keystore locked"),
      })

      const { result } = renderHook(() => useSaveSessionProfile())

      await result.current.updateCurrentProfile()

      expect(mockSaveSessionProfiles).not.toHaveBeenCalled()
      expect(mockRecordError).toHaveBeenCalledTimes(1)
      // The read comes first, so the /me round trip is skipped too
      expect(mockFetchUsername).not.toHaveBeenCalled()
    })

    it("writes nothing when no profiles are stored, since there is none to update", async () => {
      setUserMe({ id: "u1", username: "alice", defaultAccount: { id: "acct-1" } })
      mockReadSessionProfiles.mockResolvedValue({ status: "absent" })

      const { result } = renderHook(() => useSaveSessionProfile())

      await result.current.updateCurrentProfile()

      expect(mockSaveSessionProfiles).not.toHaveBeenCalled()
      expect(mockFetchUsername).not.toHaveBeenCalled()
    })
  })
})
