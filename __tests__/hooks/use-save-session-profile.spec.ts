import { renderHook } from "@testing-library/react-native"

import { DefaultAccountId } from "@app/types/wallet.types"

import { useSaveSessionProfile } from "@app/hooks/use-save-session-profile"

const mockSaveToken = jest.fn()
const mockUpdateState = jest.fn()
const mockFetchUsername = jest.fn()
const mockGetSessionProfiles = jest.fn()
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
    getSessionProfiles: (...args: unknown[]) => mockGetSessionProfiles(...args),
    saveSessionProfiles: (...args: unknown[]) => mockSaveSessionProfiles(...args),
  },
}))

jest.mock("@react-native-firebase/crashlytics", () => () => ({
  recordError: (...args: unknown[]) => mockRecordError(...args),
}))

const setUserMe = (me: {
  id: string
  username?: string | null
  phone?: string | null
  email?: { address: string } | null
  defaultAccount: { id: string }
}) => {
  mockFetchUsername.mockResolvedValue({ data: { me } })
}

describe("useSaveSessionProfile", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSaveToken.mockResolvedValue(undefined)
    mockGetSessionProfiles.mockResolvedValue([])
    mockSaveSessionProfiles.mockResolvedValue(true)
  })

  describe("saveProfile (Important #13)", () => {
    it("returns without writing when token is empty", async () => {
      const { result } = renderHook(() => useSaveSessionProfile())

      await result.current.saveProfile("")

      expect(mockSaveToken).not.toHaveBeenCalled()
      expect(mockUpdateState).not.toHaveBeenCalled()
      expect(mockGetSessionProfiles).not.toHaveBeenCalled()
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

    it("calls updateState BEFORE the profile fetch so an SC-active user lands on Custodial even if /me fails", async () => {
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
      mockGetSessionProfiles.mockResolvedValue([
        { token: "existing-token", accountId: "acct-1", selected: true },
      ])

      const { result } = renderHook(() => useSaveSessionProfile())

      await result.current.saveProfile("existing-token")

      expect(mockUpdateState).toHaveBeenCalledTimes(1)
      expect(mockFetchUsername).not.toHaveBeenCalled()
      expect(mockSaveSessionProfiles).not.toHaveBeenCalled()
    })

    it("saves a brand-new profile alongside the deselected previous ones", async () => {
      setUserMe({ id: "u1", username: "alice", defaultAccount: { id: "acct-new" } })
      mockGetSessionProfiles.mockResolvedValue([
        { token: "old-token", accountId: "acct-old", selected: true },
      ])

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
      mockGetSessionProfiles.mockResolvedValue([
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
  })
})
