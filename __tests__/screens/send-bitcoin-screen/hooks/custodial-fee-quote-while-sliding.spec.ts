import { renderHook } from "@testing-library/react-native"

import { PayoutSpeed, WalletCurrency } from "@app/graphql/generated"
import { useOnchainFeeTierOptions } from "@app/screens/send-bitcoin-screen/hooks/use-onchain-fee-tier-options"
import { OnchainFeeQuote } from "@app/screens/send-bitcoin-screen/payment-details/index.types"

/**
 * From the options hook down to the backend query, so the count below is the requests a
 * drag really sends: only the Apollo edge is stood in.
 */
const mockFetchBtcFees = jest.fn()

jest.mock("@app/graphql/generated", () => {
  const actual = jest.requireActual("@app/graphql/generated")
  return {
    ...actual,
    useOnChainTxFeeBySpeedLazyQuery: () => [mockFetchBtcFees],
    useOnChainUsdTxFeeBySpeedLazyQuery: () => [jest.fn()],
    useOnChainUsdTxFeeAsBtcDenominatedBySpeedLazyQuery: () => [jest.fn()],
  }
})

jest.mock("@app/self-custodial/providers/wallet", () => ({
  useSelfCustodialWallet: () => ({ sdk: null }),
}))

jest.mock("@app/hooks/use-display-currency", () => ({
  useDisplayCurrency: () => ({
    formatMoneyAmount: () => "",
    moneyAmountToDisplayCurrencyString: () => "",
  }),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    locale: "en",
    LL: {
      SendBitcoinScreen: {
        fast: () => "Priority",
        medium: () => "Standard",
        slow: () => "Economy",
        onchainSelfPayment: () => "Your own address",
      },
      common: { feeError: () => "Unable to calculate fee" },
    },
  }),
}))

const BALANCE = 100_000

const custodialOnchainDetail = (amount: number) =>
  ({
    paymentType: "onchain",
    destination: "bc1qtest",
    settlementAmount: { amount, currency: WalletCurrency.Btc, currencyCode: "BTC" },
    unitOfAccountAmount: { amount, currency: WalletCurrency.Btc, currencyCode: "BTC" },
    sendingWalletDescriptor: { currency: WalletCurrency.Btc, id: "btc-wallet" },
    payoutSpeed: PayoutSpeed.Fast,
    feeQuote: OnchainFeeQuote.Btc,
  }) as never

type Props = Parameters<typeof useOnchainFeeTierOptions>[0]

const props = (percent: number, isAmountSliding: boolean): Props => ({
  paymentDetail: custodialOnchainDetail((BALANCE * percent) / 100),
  isSelfCustodial: false,
  paymentDestination: undefined,
  convertMoneyAmount: undefined,
  isAmountSliding,
})

describe("a custodial on-chain fee while the amount is slid", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFetchBtcFees.mockResolvedValue({
      data: { fast: { amount: 3 }, medium: { amount: 2 }, slow: { amount: 1 } },
    })
  })

  it("is quoted once, for the amount let go at, over a 0% to 50% drag", () => {
    const { rerender } = renderHook((p: Props) => useOnchainFeeTierOptions(p), {
      initialProps: props(0, true),
    })

    for (let percent = 1; percent <= 50; percent += 1) rerender(props(percent, true))
    expect(mockFetchBtcFees).not.toHaveBeenCalled()

    rerender(props(50, false))

    expect(mockFetchBtcFees).toHaveBeenCalledTimes(1)
    expect(mockFetchBtcFees).toHaveBeenCalledWith({
      variables: { walletId: "btc-wallet", address: "bc1qtest", amount: BALANCE / 2 },
    })
  })

  it("is not shown as quoting while the thumb is held", () => {
    const { result } = renderHook(() => useOnchainFeeTierOptions(props(30, true)))

    expect(result.current.isQuotingFees).toBe(false)
    expect(mockFetchBtcFees).not.toHaveBeenCalled()
  })

  it("follows each amount as before when nothing is slid", () => {
    const { rerender } = renderHook((p: Props) => useOnchainFeeTierOptions(p), {
      initialProps: props(10, false),
    })

    rerender(props(20, false))

    expect(mockFetchBtcFees).toHaveBeenCalledTimes(2)
  })
})
