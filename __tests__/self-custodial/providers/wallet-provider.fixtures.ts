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

/** Minimal connected SDK mock: `initSdk` resolves, snapshot returns empty wallets. */
export const setupConnectedWallet = (
  mocks: {
    getMnemonic: jest.Mock
    initSdk: jest.Mock
    addSdkEventListener: jest.Mock
  },
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
  mocks.getMnemonic.mockResolvedValue("word1 word2 word3")
  mocks.initSdk.mockResolvedValue({})

  return { listener }
}
