import { act, renderHook, waitFor } from "@testing-library/react-native"

import { DefaultAccountId } from "@app/types/wallet"

import { useResolveTransactionAccount } from "@app/hooks/use-resolve-transaction-account"

const mockSaveToken = jest.fn()
const mockSetActiveAccountId = jest.fn()
const mockProbeOwnership = jest.fn()
const mockProbeWallet = jest.fn()
const mockGetSessionProfiles = jest.fn()
const mockToastShow = jest.fn()
const mockRecordError = jest.fn()

let mockClient: Record<string, unknown> = {}
jest.mock("@apollo/client", () => ({
  ...jest.requireActual("@apollo/client"),
  useApolloClient: () => mockClient,
}))

let mockIsAuthed = true
jest.mock("@app/graphql/is-authed-context", () => ({
  useIsAuthed: () => mockIsAuthed,
}))

jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useTransactionOwnershipProbeLazyQuery: () => [mockProbeOwnership],
  useTransactionByIdForWalletLazyQuery: () => [mockProbeWallet],
}))

jest.mock("@app/hooks/use-app-config", () => {
  const appConfigResult = {
    saveToken: (...args: unknown[]) => mockSaveToken(...args),
    appConfig: { token: "token-active" },
  }
  return { useAppConfig: () => appConfigResult }
})

jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => ({ setActiveAccountId: mockSetActiveAccountId }),
}))

jest.mock("@app/i18n/i18n-react", () => {
  const i18nResult = { LL: {} }
  return { useI18nContext: () => i18nResult }
})

jest.mock("@app/utils/storage/secureStorage", () => ({
  __esModule: true,
  default: {
    getSessionProfiles: (...args: unknown[]) => mockGetSessionProfiles(...args),
  },
}))

jest.mock("@app/utils/toast", () => ({
  toastShow: (...args: unknown[]) => mockToastShow(...args),
}))

jest.mock("@react-native-firebase/crashlytics", () => () => ({
  recordError: (...args: unknown[]) => mockRecordError(...args),
}))

const TXID = "tx-target"

type ProbeOptions = {
  context?: { headers: { authorization: string } }
  variables: { walletId?: string; txId?: string; first?: number }
  fetchPolicy: string
}

const tokenOf = (options: ProbeOptions): string | undefined =>
  options.context?.headers.authorization.replace("Bearer ", "")

const ownershipResult = ({
  txIds = [],
  pendingIds = [],
  walletIds = ["w-btc", "w-usd"],
}: {
  txIds?: string[]
  pendingIds?: string[]
  walletIds?: string[]
}) => ({
  data: {
    me: {
      defaultAccount: {
        wallets: walletIds.map((id) => ({ id })),
        pendingIncomingTransactions: pendingIds.map((id) => ({ id })),
        transactions: { edges: txIds.map((id) => ({ node: { id } })) },
      },
    },
  },
})

const walletHit = {
  data: {
    me: { defaultAccount: { walletById: { transactionById: { id: TXID } } } },
  },
}

const walletMiss = {
  data: undefined,
  error: { message: "not found", graphQLErrors: [{ message: "not found" }] },
}

const networkFailure = {
  data: undefined,
  error: { message: "fetch failed", networkError: new Error("fetch failed") },
}

const profileA = {
  token: "token-active",
  userId: "user-a",
  accountId: "acct-a",
  identifier: "alice",
  hasUsername: true,
  lnAddressHostname: "blink.sv",
  selected: true,
}
const profileB = {
  token: "token-b",
  userId: "user-b",
  accountId: "acct-b",
  identifier: "bob",
  hasUsername: true,
  lnAddressHostname: "blink.sv",
  selected: false,
}
const profileC = {
  token: "token-c",
  userId: "user-c",
  accountId: "acct-c",
  identifier: "+4670000000",
  hasUsername: false,
  lnAddressHostname: "blink.sv",
  selected: false,
}

/** Routes ownership probes by the Bearer token: active probes carry no context. */
const setOwnershipByToken = (
  resultsByToken: Record<
    string,
    ReturnType<typeof ownershipResult> | typeof networkFailure
  >,
  activeResult?: ReturnType<typeof ownershipResult> | typeof networkFailure,
) => {
  mockProbeOwnership.mockImplementation((options: ProbeOptions) => {
    const token = tokenOf(options)
    if (!token) return Promise.resolve(activeResult ?? ownershipResult({}))
    return Promise.resolve(resultsByToken[token] ?? ownershipResult({}))
  })
}

const renderResolver = (
  overrides: Partial<{ txid: string; hasTx: boolean; recipientUserId?: string }> = {},
) =>
  renderHook(
    (props: { txid: string; hasTx: boolean; recipientUserId?: string }) =>
      useResolveTransactionAccount(props),
    { initialProps: { txid: TXID, hasTx: false, ...overrides } },
  )

describe("useResolveTransactionAccount", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockClient = {}
    mockIsAuthed = true
    mockSaveToken.mockResolvedValue(undefined)
    mockGetSessionProfiles.mockResolvedValue([profileA, profileB, profileC])
    mockProbeWallet.mockResolvedValue(walletMiss)
  })

  it("does nothing when the transaction is already available", async () => {
    const { result } = renderResolver({ hasTx: true })

    await waitFor(() => expect(result.current.status).toBe("idle"))
    expect(mockProbeOwnership).not.toHaveBeenCalled()
    expect(mockProbeWallet).not.toHaveBeenCalled()
    expect(mockSaveToken).not.toHaveBeenCalled()
  })

  it("resolves without switching when the active account owns the tx (list probe + wallet materialization)", async () => {
    setOwnershipByToken({}, ownershipResult({ txIds: [TXID] }))
    mockProbeWallet.mockResolvedValue(walletHit)

    const { result } = renderResolver()

    await waitFor(() => expect(result.current.status).toBe("resolved"))
    expect(mockSaveToken).not.toHaveBeenCalled()
    expect(mockSetActiveAccountId).not.toHaveBeenCalled()

    // Materialization runs against the active account: cache-writing, no Bearer override
    const walletCall = mockProbeWallet.mock.calls[0][0]
    expect(walletCall.fetchPolicy).toBe("network-only")
    expect(walletCall.context).toBeUndefined()
  })

  it("resolves via the per-wallet probe when the tx is older than the list window", async () => {
    setOwnershipByToken({}, ownershipResult({ txIds: ["tx-other"] }))
    mockProbeWallet.mockImplementation((options: ProbeOptions) =>
      Promise.resolve(options.variables.walletId === "w-usd" ? walletHit : walletMiss),
    )

    const { result } = renderResolver()

    await waitFor(() => expect(result.current.status).toBe("resolved"))
    expect(mockSaveToken).not.toHaveBeenCalled()
    expect(mockProbeWallet).toHaveBeenCalledTimes(2)
  })

  it("switches to the saved profile that owns the tx and shows a toast", async () => {
    setOwnershipByToken({ "token-b": ownershipResult({ txIds: [TXID] }) })

    const { result } = renderResolver()

    await waitFor(() => expect(result.current.status).toBe("switching"))
    expect(mockSaveToken).toHaveBeenCalledWith("token-b")
    expect(mockSetActiveAccountId).toHaveBeenCalledWith(DefaultAccountId.Custodial)

    expect(mockToastShow).toHaveBeenCalledTimes(1)
    const toastArgs = mockToastShow.mock.calls[0][0]
    expect(toastArgs.type).toBe("success")
    const message = toastArgs.message({
      TransactionDetailScreen: {
        switchedForPayment: ({ identifier }: { identifier: string }) =>
          `Switched to ${identifier}`,
      },
    })
    expect(message).toBe("Switched to bob@blink.sv")
  })

  it("resolves under the rebuilt client after a switch without switching again", async () => {
    setOwnershipByToken({ "token-b": ownershipResult({ txIds: [TXID] }) })

    const { result, rerender } = renderResolver()
    await waitFor(() => expect(result.current.status).toBe("switching"))

    // The token change rebuilds the Apollo client; now the tx is in the active account
    setOwnershipByToken({}, ownershipResult({ txIds: [TXID] }))
    mockProbeWallet.mockResolvedValue(walletHit)
    mockSaveToken.mockClear()
    mockClient = {}
    rerender({ txid: TXID, hasTx: false })

    await waitFor(() => expect(result.current.status).toBe("resolved"))
    expect(mockSaveToken).not.toHaveBeenCalled()
  })

  it("reports notFound when no account on the device owns the tx", async () => {
    setOwnershipByToken({})

    const { result } = renderResolver()

    await waitFor(() => expect(result.current.status).toBe("notFound"))
    expect(mockSaveToken).not.toHaveBeenCalled()
    expect(mockToastShow).not.toHaveBeenCalled()
  })

  it("never switches when the active-account probe fails", async () => {
    setOwnershipByToken({ "token-b": ownershipResult({ txIds: [TXID] }) }, networkFailure)

    const { result } = renderResolver()

    await waitFor(() => expect(result.current.status).toBe("probeFailed"))
    expect(mockSaveToken).not.toHaveBeenCalled()
    expect(mockRecordError).toHaveBeenCalled()
  })

  it("reports probeFailed instead of notFound when a foreign probe fails without any hit", async () => {
    setOwnershipByToken({ "token-b": networkFailure })

    const { result } = renderResolver()

    await waitFor(() => expect(result.current.status).toBe("probeFailed"))
    expect(mockSaveToken).not.toHaveBeenCalled()
  })

  it("probes only the hinted profile when recipientUserId matches", async () => {
    setOwnershipByToken({ "token-b": ownershipResult({ txIds: [TXID] }) })

    const { result } = renderResolver({ recipientUserId: "user-b" })

    await waitFor(() => expect(result.current.status).toBe("switching"))
    const probedTokens = mockProbeOwnership.mock.calls.map((call) => tokenOf(call[0]))
    expect(probedTokens).toContain("token-b")
    expect(probedTokens).not.toContain("token-c")
  })

  it("skips the active-account probe when a self-custodial account is active", async () => {
    mockIsAuthed = false
    setOwnershipByToken({ "token-b": ownershipResult({ txIds: [TXID] }) })

    const { result } = renderResolver()

    await waitFor(() => expect(result.current.status).toBe("switching"))
    const bearerlessCalls = mockProbeOwnership.mock.calls.filter(
      (call) => tokenOf(call[0]) === undefined,
    )
    expect(bearerlessCalls).toHaveLength(0)
  })

  it("sends Bearer overrides and no-cache on foreign probes only", async () => {
    setOwnershipByToken({}, ownershipResult({ txIds: ["tx-other"] }))

    const { result } = renderResolver()
    await waitFor(() => expect(result.current.status).toBe("notFound"))

    for (const [options] of mockProbeOwnership.mock.calls) {
      expect(options.fetchPolicy).toBe("no-cache")
    }
    const foreignCalls = mockProbeOwnership.mock.calls.filter((call) => tokenOf(call[0]))
    expect(foreignCalls.length).toBeGreaterThan(0)
    for (const [options] of foreignCalls) {
      expect(options.context?.headers.authorization).toMatch(/^Bearer token-/)
    }
  })

  it("finds the tx among pending incoming transactions", async () => {
    setOwnershipByToken({}, ownershipResult({ pendingIds: [TXID] }))
    mockProbeWallet.mockResolvedValue(walletHit)

    const { result } = renderResolver()

    await waitFor(() => expect(result.current.status).toBe("resolved"))
    expect(mockSaveToken).not.toHaveBeenCalled()
  })

  it("reports probeFailed when an active wallet probe hits a transport error", async () => {
    setOwnershipByToken(
      { "token-b": ownershipResult({ txIds: [TXID] }) },
      ownershipResult({ txIds: ["tx-other"] }),
    )
    mockProbeWallet.mockResolvedValue(networkFailure)

    const { result } = renderResolver()

    await waitFor(() => expect(result.current.status).toBe("probeFailed"))
    expect(mockSaveToken).not.toHaveBeenCalled()
    expect(mockRecordError).toHaveBeenCalled()
  })

  it("retry re-runs probing after a failure", async () => {
    setOwnershipByToken({}, networkFailure)

    const { result } = renderResolver()
    await waitFor(() => expect(result.current.status).toBe("probeFailed"))

    setOwnershipByToken({}, ownershipResult({ txIds: [TXID] }))
    mockProbeWallet.mockResolvedValue(walletHit)
    act(() => result.current.retry())

    await waitFor(() => expect(result.current.status).toBe("resolved"))
  })

  it("fails instead of switching again when the tx is gone after the switch", async () => {
    setOwnershipByToken({ "token-b": ownershipResult({ txIds: [TXID] }) })

    const { result, rerender } = renderResolver()
    await waitFor(() => expect(result.current.status).toBe("switching"))
    expect(mockSaveToken).toHaveBeenCalledTimes(1)

    // Rebuilt client, but the newly-active account no longer reports the tx
    // while the (now inactive) profile B still would — must not switch again.
    mockClient = {}
    rerender({ txid: TXID, hasTx: false })

    await waitFor(() => expect(result.current.status).toBe("probeFailed"))
    expect(mockSaveToken).toHaveBeenCalledTimes(1)
  })

  it("treats a keystore read failure as having no saved profiles", async () => {
    mockGetSessionProfiles.mockRejectedValue(new Error("keystore unavailable"))

    const { result } = renderResolver()

    await waitFor(() => expect(result.current.status).toBe("notFound"))
    expect(mockRecordError).toHaveBeenCalled()
  })

  it("reports notFound without foreign probes when only the active profile is saved", async () => {
    mockGetSessionProfiles.mockResolvedValue([profileA])
    setOwnershipByToken({})

    const { result } = renderResolver()

    await waitFor(() => expect(result.current.status).toBe("notFound"))
    // Only the bearer-less active-account probe ran
    expect(mockProbeOwnership).toHaveBeenCalledTimes(1)
    expect(tokenOf(mockProbeOwnership.mock.calls[0][0])).toBeUndefined()
  })

  it("toasts the raw identifier for a profile without a username", async () => {
    setOwnershipByToken({ "token-c": ownershipResult({ txIds: [TXID] }) })

    const { result } = renderResolver()

    await waitFor(() => expect(result.current.status).toBe("switching"))
    const message = mockToastShow.mock.calls[0][0].message({
      TransactionDetailScreen: {
        switchedForPayment: ({ identifier }: { identifier: string }) => identifier,
      },
    })
    expect(message).toBe("+4670000000")
  })

  it("never switches when two profiles both claim the tx", async () => {
    setOwnershipByToken({
      "token-b": ownershipResult({ txIds: [TXID] }),
      "token-c": ownershipResult({ txIds: [TXID] }),
    })

    const { result } = renderResolver()

    await waitFor(() => expect(result.current.status).toBe("probeFailed"))
    expect(mockSaveToken).not.toHaveBeenCalled()
    expect(mockToastShow).not.toHaveBeenCalled()
  })
})
