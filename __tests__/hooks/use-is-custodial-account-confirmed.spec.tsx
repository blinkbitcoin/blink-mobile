import { act, renderHook } from "@testing-library/react-native"

import { AccountRegistryProvider } from "@app/hooks/use-account-registry"
import { useIsCustodialAccountConfirmed } from "@app/hooks/use-is-custodial-account-confirmed"

const mockUseIsAuthed = jest.fn()
const mockGetSessionProfiles = jest.fn()
const mockListSelfCustodialAccounts = jest.fn()
let mockActiveAccountId: string | undefined

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

jest.mock("@app/store/persistent-state", () => ({
  usePersistentStateContext: () => ({
    persistentState: { activeAccountId: mockActiveAccountId, galoyAuthToken: "token" },
    updateState: jest.fn(),
  }),
}))

jest.mock("@app/utils/storage/secureStorage", () => ({
  __esModule: true,
  default: { getSessionProfiles: () => mockGetSessionProfiles() },
}))

jest.mock("@app/self-custodial/storage/account-index", () => ({
  listSelfCustodialAccounts: () => mockListSelfCustodialAccounts(),
  StorageReadStatus: { Ok: "ok", ReadFailed: "read-failed" },
}))

const renderConfirmed = async () => {
  const rendered = renderHook(() => useIsCustodialAccountConfirmed(), {
    wrapper: AccountRegistryProvider,
  })
  await act(async () => {
    await Promise.resolve()
  })
  return rendered
}

/** Decisions that must not treat an unknown account as custodial read this, not the
 *  wallet's placeholder, which is custodial for a selection that matches nothing. */
describe("useIsCustodialAccountConfirmed", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockActiveAccountId = undefined
    mockUseIsAuthed.mockReturnValue(true)
    mockGetSessionProfiles.mockResolvedValue([{ accountId: "custodial" }])
    mockListSelfCustodialAccounts.mockResolvedValue({ status: "ok", entries: [] })
  })

  it("confirms a custodial account once the registry has settled", async () => {
    const { result } = await renderConfirmed()

    expect(result.current).toBe(true)
  })

  it("confirms nothing while the registry is still loading", () => {
    mockListSelfCustodialAccounts.mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useIsCustodialAccountConfirmed(), {
      wrapper: AccountRegistryProvider,
    })

    expect(result.current).toBe(false)
  })

  it("confirms nothing for a self-custodial account", async () => {
    mockActiveAccountId = "sc-1"
    mockListSelfCustodialAccounts.mockResolvedValue({
      status: "ok",
      entries: [{ id: "sc-1", lightningAddress: null }],
    })

    const { result } = await renderConfirmed()

    expect(result.current).toBe(false)
  })

  /** A persisted self-custodial selection, an index read that succeeds empty and a
   *  retained custodial session: the selection matches no loaded account, and the
   *  account is not known to be custodial. */
  it("confirms nothing when the selection matches no loaded account", async () => {
    mockActiveAccountId = "sc-1"

    const { result } = await renderConfirmed()

    expect(result.current).toBe(false)
  })

  it("confirms nothing when the index read fails and the seeded entry stays", async () => {
    mockActiveAccountId = "sc-1"
    mockListSelfCustodialAccounts.mockResolvedValue({ status: "read-failed" })

    const { result } = await renderConfirmed()

    expect(result.current).toBe(false)
  })
})
