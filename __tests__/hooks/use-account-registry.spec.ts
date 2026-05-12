import { renderHook, act } from "@testing-library/react-native"

import { AccountStatus, AccountType, DefaultAccountId } from "@app/types/wallet"

import {
  createCustodialDescriptor,
  createSelfCustodialDescriptor,
  markSelected,
  useAccountRegistry,
} from "@app/hooks/use-account-registry"

const mockUseIsAuthed = jest.fn()
const mockUpdateState = jest.fn()
const mockGetSessionProfiles = jest.fn()

jest.mock("@app/graphql/is-authed-context", () => ({
  useIsAuthed: () => mockUseIsAuthed(),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      AccountTypeSelectionScreen: {
        custodialLabel: () => "Blink",
        selfCustodialLabel: () => "Spark",
      },
    },
  }),
}))

jest.mock("@app/config/feature-flags-context", () => ({
  useFeatureFlags: () => ({
    nonCustodialEnabled: mockNonCustodialEnabled,
  }),
}))

jest.mock("@app/store/persistent-state", () => ({
  usePersistentStateContext: () => ({
    persistentState: {
      activeAccountId: mockActiveAccountId,
      galoyAuthToken: mockGaloyAuthToken,
    },
    updateState: mockUpdateState,
  }),
}))

jest.mock("@app/utils/storage/secureStorage", () => ({
  __esModule: true,
  default: {
    getSessionProfiles: () => mockGetSessionProfiles(),
  },
}))

const mockListSelfCustodialAccounts = jest.fn()
jest.mock("@app/self-custodial/storage/account-index", () => ({
  listSelfCustodialAccounts: () => mockListSelfCustodialAccounts(),
  StorageReadStatus: { Ok: "ok", ReadFailed: "read-failed" },
}))

let mockNonCustodialEnabled = false
let mockActiveAccountId: string | undefined
let mockGaloyAuthToken = "token"

const flushAsyncEffects = async () => {
  await act(async () => {
    await Promise.resolve()
  })
}

describe("useAccountRegistry", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockNonCustodialEnabled = false
    mockActiveAccountId = undefined
    mockGaloyAuthToken = "token"
    mockListSelfCustodialAccounts.mockResolvedValue({ status: "ok", entries: [] })
    mockGetSessionProfiles.mockResolvedValue([])
  })

  it("returns custodial account when authenticated", async () => {
    mockUseIsAuthed.mockReturnValue(true)

    const { result } = renderHook(() => useAccountRegistry())
    await flushAsyncEffects()

    expect(result.current.accounts).toHaveLength(1)
    expect(result.current.accounts[0].type).toBe(AccountType.Custodial)
    expect(result.current.accounts[0].label).toBe("Blink")
    expect(result.current.accounts[0].status).toBe(AccountStatus.Available)
  })

  it("returns empty accounts when not authenticated and KeyStore empty", async () => {
    mockUseIsAuthed.mockReturnValue(false)

    const { result } = renderHook(() => useAccountRegistry())
    await flushAsyncEffects()

    expect(result.current.accounts).toHaveLength(0)
    expect(result.current.activeAccount).toBeUndefined()
  })

  it("includes custodial descriptor when KeyStore has a saved profile even if token is empty", async () => {
    // Repro of the asymmetry where switch-account showed custodial but home did not.
    mockUseIsAuthed.mockReturnValue(false)
    mockGaloyAuthToken = ""
    mockGetSessionProfiles.mockResolvedValue([
      { token: "stale", identifier: "esau", lnAddressHostname: "blink.sv" },
    ])

    const { result } = renderHook(() => useAccountRegistry())
    await flushAsyncEffects()

    expect(result.current.accounts).toHaveLength(1)
    expect(result.current.accounts[0].type).toBe(AccountType.Custodial)
  })

  it("excludes custodial descriptor when both token and KeyStore are empty", async () => {
    mockUseIsAuthed.mockReturnValue(false)
    mockGaloyAuthToken = ""
    mockGetSessionProfiles.mockResolvedValue([])

    const { result } = renderHook(() => useAccountRegistry())
    await flushAsyncEffects()

    expect(result.current.accounts).toHaveLength(0)
  })

  it("includes self-custodial accounts loaded from the index", async () => {
    mockUseIsAuthed.mockReturnValue(true)
    mockNonCustodialEnabled = true
    mockListSelfCustodialAccounts.mockResolvedValue({
      status: "ok",
      entries: [{ id: "self-custodial-uuid-1", lightningAddress: null }],
    })

    const { result } = renderHook(() => useAccountRegistry())
    await flushAsyncEffects()

    expect(result.current.accounts).toHaveLength(2)
    expect(result.current.accounts[1].type).toBe(AccountType.SelfCustodial)
    expect(result.current.accounts[1].id).toBe("self-custodial-uuid-1")
    expect(result.current.accounts[1].status).toBe(AccountStatus.RequiresRestore)
  })

  it("selects first account by default when no activeAccountId", async () => {
    mockUseIsAuthed.mockReturnValue(true)

    const { result } = renderHook(() => useAccountRegistry())
    await flushAsyncEffects()

    expect(result.current.activeAccount?.id).toBe(DefaultAccountId.Custodial)
    expect(result.current.activeAccount?.selected).toBe(true)
  })

  it("selects account matching activeAccountId", async () => {
    mockUseIsAuthed.mockReturnValue(true)
    mockNonCustodialEnabled = true
    mockActiveAccountId = "self-custodial-uuid-1"
    mockListSelfCustodialAccounts.mockResolvedValue({
      status: "ok",
      entries: [{ id: "self-custodial-uuid-1", lightningAddress: null }],
    })

    const { result } = renderHook(() => useAccountRegistry())
    await flushAsyncEffects()

    expect(result.current.activeAccount?.id).toBe("self-custodial-uuid-1")
    expect(result.current.activeAccount?.type).toBe(AccountType.SelfCustodial)
  })

  it("setActiveAccountId calls updateState with the new id", async () => {
    mockUseIsAuthed.mockReturnValue(true)

    const { result } = renderHook(() => useAccountRegistry())
    await flushAsyncEffects()

    act(() => {
      result.current.setActiveAccountId("self-custodial-uuid-1")
    })

    expect(mockUpdateState).toHaveBeenCalledTimes(1)
    const updater = mockUpdateState.mock.calls[0][0]
    expect(updater({ activeAccountId: "old" })).toEqual({
      activeAccountId: "self-custodial-uuid-1",
    })
  })

  it("does NOT clobber seeded self-custodial entries when the index read fails", async () => {
    // Repro: a transient AsyncStorage failure used to surface as `[]` from
    // listSelfCustodialAccounts, which clobbered the seeded entry — every self-custodial
    // account vanished from the registry until next reload.
    mockUseIsAuthed.mockReturnValue(false)
    mockNonCustodialEnabled = true
    mockActiveAccountId = "self-custodial-uuid-1"
    mockListSelfCustodialAccounts.mockResolvedValue({
      status: "read-failed",
      error: new Error("AsyncStorage unavailable"),
    })

    const { result } = renderHook(() => useAccountRegistry())
    await flushAsyncEffects()

    expect(result.current.selfCustodialEntries).toEqual([
      { id: "self-custodial-uuid-1", lightningAddress: null },
    ])
    expect(result.current.activeAccount?.id).toBe("self-custodial-uuid-1")
  })

  it("setActiveAccountId is a single state mutation (no token rewrite)", async () => {
    // Regression: a previous version of setActiveAccountId called
    // saveToken(persistentState.galoyAuthToken) when switching to custodial,
    // which used a stale closure value and reverted in-flight token swaps.
    mockUseIsAuthed.mockReturnValue(true)

    const { result } = renderHook(() => useAccountRegistry())
    await flushAsyncEffects()

    act(() => {
      result.current.setActiveAccountId(DefaultAccountId.Custodial)
    })

    expect(mockUpdateState).toHaveBeenCalledTimes(1)
  })
})

describe("createCustodialDescriptor", () => {
  it("creates a custodial descriptor with correct defaults", () => {
    const desc = createCustodialDescriptor("Blink")

    expect(desc.id).toBe(DefaultAccountId.Custodial)
    expect(desc.type).toBe(AccountType.Custodial)
    expect(desc.label).toBe("Blink")
    expect(desc.selected).toBe(false)
    expect(desc.status).toBe(AccountStatus.Available)
  })
})

describe("createSelfCustodialDescriptor", () => {
  it("creates a self-custodial descriptor with correct defaults", () => {
    const desc = createSelfCustodialDescriptor("self-custodial-id-1", "Spark")

    expect(desc.id).toBe("self-custodial-id-1")
    expect(desc.type).toBe(AccountType.SelfCustodial)
    expect(desc.label).toBe("Spark")
    expect(desc.selected).toBe(false)
    expect(desc.status).toBe(AccountStatus.RequiresRestore)
  })
})

describe("markSelected", () => {
  const accounts = [
    createCustodialDescriptor("Blink"),
    createSelfCustodialDescriptor("self-custodial-id-1", "Spark"),
  ]

  it("marks account matching activeId as selected", () => {
    const result = markSelected(accounts, "self-custodial-id-1")

    expect(result[0].selected).toBe(false)
    expect(result[1].selected).toBe(true)
  })

  it("selects first account when activeId is undefined", () => {
    const result = markSelected(accounts, undefined)

    expect(result[0].selected).toBe(true)
    expect(result[1].selected).toBe(false)
  })

  it("selects none when list is empty", () => {
    const result = markSelected([], "some-id")

    expect(result).toHaveLength(0)
  })
})
