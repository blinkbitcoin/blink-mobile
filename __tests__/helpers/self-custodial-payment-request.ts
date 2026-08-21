import { WalletCurrency } from "@app/graphql/generated"

/**
 * Fixtures and default mock behaviour shared by the self-custodial receive specs.
 *
 * The `jest.mock` factories themselves have to stay in each spec file (babel hoists
 * them above imports), but everything they resolve to lives here so the two suites
 * cannot drift apart.
 */

export const btcWallet = {
  id: "btc-w1",
  walletCurrency: WalletCurrency.Btc,
  balance: { amount: 1000, currency: WalletCurrency.Btc, currencyCode: "BTC" },
  transactions: [],
}

export const usdWallet = {
  id: "usd-w1",
  walletCurrency: WalletCurrency.Usd,
  balance: { amount: 500, currency: WalletCurrency.Usd, currencyCode: "USD" },
  transactions: [],
}

export const mockSdk = { id: "mock-sdk" }

export const btcAmount = (amount: number) => ({
  amount,
  currency: WalletCurrency.Btc,
  currencyCode: "BTC",
})

/** An incoming on-chain transaction — what marks a deposit address as used. */
export const onchainReceipt = (id: string) => ({
  id,
  amount: btcAmount(1000),
  direction: "receive",
  status: "completed",
  timestamp: 1_700_000_000,
  paymentType: "onchain",
})

/**
 * An unclaimed on-chain deposit. Only the id is read by the receive hook, but the
 * shape mirrors `PendingDeposit` so a spec can widen its assertions later.
 */
export const pendingDeposit = (txid: string, vout = 0) => ({
  id: `${txid}:${vout}`,
  txid,
  vout,
  amount: btcAmount(1000),
  status: "pending",
  errorReason: null,
})

export type PaymentRequestMocks = {
  receiveLightning: jest.Mock
  receiveOnchain: jest.Mock
  selfCustodialWallet: jest.Mock
  activeWallet: jest.Mock
  convertMoneyAmount: jest.Mock
  addPendingAutoConvert: jest.Mock
  fetchAutoConvertMinSats: jest.Mock
  useReceiveAssetMode: jest.Mock
  formatMoneyAmount: jest.Mock
  /** `useLightningAddressGated`, which decides whether the address is offered at all. */
  lightningAddressGated: jest.Mock
  /** `usePendingDeposits`, which the hook consults before reusing an address. */
  pendingDeposits?: jest.Mock
}

/** Puts every mock in the "self-custodial wallet is ready, BTC mode" baseline state. */
export const applyPaymentRequestDefaults = (mocks: PaymentRequestMocks): void => {
  mocks.selfCustodialWallet.mockReturnValue({
    sdk: mockSdk,
    lastReceivedPaymentId: null,
    allTransactions: [],
  })
  mocks.activeWallet.mockReturnValue({ wallets: [btcWallet, usdWallet], isReady: true })
  mocks.receiveLightning.mockResolvedValue({ invoice: "lnbc1test..." })
  mocks.receiveOnchain.mockResolvedValue({ address: "bc1qtest..." })
  mocks.convertMoneyAmount.mockImplementation(
    (amount: { amount: number }, currency: string) => ({
      amount: amount.amount,
      currency,
      currencyCode: currency,
    }),
  )
  mocks.formatMoneyAmount.mockImplementation(
    ({ moneyAmount }: { moneyAmount: { amount: number } }) => `$${moneyAmount.amount}`,
  )
  mocks.addPendingAutoConvert.mockResolvedValue(undefined)
  mocks.fetchAutoConvertMinSats.mockResolvedValue(undefined)
  mocks.useReceiveAssetMode.mockReturnValue({
    assetMode: "bitcoin",
    setAssetMode: jest.fn(),
    isToggleDisabled: false,
    loading: false,
  })
  mocks.lightningAddressGated.mockReturnValue(false)
  mocks.pendingDeposits?.mockReturnValue({ deposits: [], refetch: jest.fn() })
}
