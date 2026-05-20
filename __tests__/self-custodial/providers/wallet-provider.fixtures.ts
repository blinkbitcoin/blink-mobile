// Shared setup helpers for SelfCustodialWalletProvider specs. The `jest.mock`
// calls themselves must stay at the top of each spec file (Jest hoists them),
// but these helpers remove the repeated mock-access and lifecycle wiring from
// every test body.

type WalletSnapshot = {
  wallets: unknown[]
  hasMore: boolean
  rawTransactionCount?: number
}
type SdkEventListener = (event: { tag: string; inner?: unknown }) => Promise<void>

type CapturedListenerRef = { current: SdkEventListener | null }

type WalletSnapshotMocks = {
  getSelfCustodialWalletSnapshot: jest.Mock
  loadMoreTransactions: jest.Mock
  appendTransactions: jest.Mock
}

export const getWalletSnapshotMocks = (): WalletSnapshotMocks =>
  jest.requireMock("@app/self-custodial/providers/wallet-snapshot")

export const TEST_SC_ACCOUNT_ID = "test-sc-uuid"

type SetupMocks = {
  getMnemonicForAccount: jest.Mock
  initSdk: jest.Mock
  addSdkEventListener: jest.Mock
  listSelfCustodialAccounts: jest.Mock
  setActiveAccountId: (id: string) => void
}

/** Minimal connected SDK mock: `initSdk` resolves, snapshot returns empty wallets. */
export const setupConnectedWallet = (
  mocks: SetupMocks,
  snapshot: WalletSnapshot = { wallets: [], hasMore: false },
): { listener: CapturedListenerRef } => {
  const listener: CapturedListenerRef = { current: null }

  const snapshotMocks = getWalletSnapshotMocks()
  snapshotMocks.getSelfCustodialWalletSnapshot.mockResolvedValue(snapshot)

  mocks.addSdkEventListener.mockImplementation(
    (_sdk: unknown, onEvent: SdkEventListener) => {
      listener.current = onEvent
      return Promise.resolve("id")
    },
  )
  mocks.getMnemonicForAccount.mockResolvedValue("word1 word2 word3")
  mocks.initSdk.mockResolvedValue({})
  mocks.listSelfCustodialAccounts.mockResolvedValue([
    { id: TEST_SC_ACCOUNT_ID, lightningAddress: null },
  ])
  mocks.setActiveAccountId(TEST_SC_ACCOUNT_ID)

  return { listener }
}
