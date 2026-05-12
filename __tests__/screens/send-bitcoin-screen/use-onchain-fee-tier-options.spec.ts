import { renderHook, act } from "@testing-library/react-native"

import { FeeTierOption } from "@app/screens/send-bitcoin-screen/hooks/fee-tiers.types"
import { SdkFeeError } from "@app/screens/send-bitcoin-screen/hooks/use-onchain-fee-tiers"
import { useOnchainFeeTierOptions } from "@app/screens/send-bitcoin-screen/hooks/use-onchain-fee-tier-options"
import { WalletCurrency } from "@app/graphql/generated"

const mockSdk = { id: "sdk" } as never

let mockFeeTiers = {
  [FeeTierOption.Fast]: { feeSats: 30, etaMinutes: 10 },
  [FeeTierOption.Medium]: { feeSats: 20, etaMinutes: 30 },
  [FeeTierOption.Slow]: { feeSats: 10, etaMinutes: 60 },
}
let mockFeeError: SdkFeeError | null = null

jest.mock("@app/self-custodial/providers/wallet", () => ({
  useSelfCustodialWallet: () => ({ sdk: mockSdk }),
}))

jest.mock("@app/hooks/use-display-currency", () => ({
  useDisplayCurrency: () => ({
    formatMoneyAmount: ({ moneyAmount }: { moneyAmount: { amount: number } }) =>
      `${moneyAmount.amount} sats`,
  }),
}))

jest.mock("@app/screens/send-bitcoin-screen/hooks/use-onchain-fee-tiers", () => {
  const actual = jest.requireActual(
    "@app/screens/send-bitcoin-screen/hooks/use-onchain-fee-tiers",
  )
  return {
    ...actual,
    useOnchainFeeTiers: () => ({ tiers: mockFeeTiers, error: mockFeeError }),
  }
})

const mockRebuilt = jest.fn()
const mockCreatePaymentDetail = jest.fn()
const mockSetAmount = jest
  .fn()
  .mockImplementation((amt) => ({ ...mockRebuilt, amount: amt }))

jest.mock("@app/self-custodial/payment-details/wrap-destination", () => ({
  wrapDestination: jest.fn(() => ({
    valid: true,
    createPaymentDetail: (...args: unknown[]) => {
      mockCreatePaymentDetail(...args)
      return {
        paymentType: "onchain",
        canSetAmount: true,
        setAmount: (amt: unknown) => mockSetAmount(amt),
      }
    },
  })),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    locale: "en",
    LL: {
      SendBitcoinScreen: {
        fast: () => "Fast",
        medium: () => "Medium",
        slow: () => "Slow",
        sdkInsufficientFunds: () => "Insufficient funds",
        sdkAmountTooLow: () => "Amount too low",
        sdkNetworkError: () => "Network error",
        sdkGenericError: () => "Generic error",
      },
    },
  }),
}))

const buildOnchainDetailRaw = (): Record<string, unknown> => ({
  paymentType: "onchain",
  destination: "bc1qaddr",
  settlementAmount: { amount: 5000, currency: WalletCurrency.Btc, currencyCode: "BTC" },
  sendingWalletDescriptor: { currency: WalletCurrency.Btc, id: "btc-w" },
  unitOfAccountAmount: {
    amount: 5000,
    currency: WalletCurrency.Btc,
    currencyCode: "BTC",
  },
})

const buildOnchainDetail = () => buildOnchainDetailRaw() as never

describe("useOnchainFeeTierOptions", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFeeError = null
    mockFeeTiers = {
      [FeeTierOption.Fast]: { feeSats: 30, etaMinutes: 10 },
      [FeeTierOption.Medium]: { feeSats: 20, etaMinutes: 30 },
      [FeeTierOption.Slow]: { feeSats: 10, etaMinutes: 60 },
    }
  })

  it("starts with feeTier = Medium", () => {
    const { result } = renderHook(() =>
      useOnchainFeeTierOptions({
        paymentDetail: null,
        isSelfCustodial: true,
        paymentDestination: undefined,
        convertMoneyAmount: undefined,
      }),
    )

    expect(result.current.feeTier).toBe(FeeTierOption.Medium)
  })

  it("isOnchain is true only when SC + onchain payment type", () => {
    const { result, rerender } = renderHook(
      (props: Parameters<typeof useOnchainFeeTierOptions>[0]) =>
        useOnchainFeeTierOptions(props),
      {
        initialProps: {
          paymentDetail: buildOnchainDetail(),
          isSelfCustodial: true,
          paymentDestination: undefined,
          convertMoneyAmount: undefined,
        },
      },
    )

    expect(result.current.isOnchain).toBe(true)

    rerender({
      paymentDetail: buildOnchainDetail(),
      isSelfCustodial: false,
      paymentDestination: undefined,
      convertMoneyAmount: undefined,
    })
    expect(result.current.isOnchain).toBe(false)

    rerender({
      paymentDetail: { ...buildOnchainDetailRaw(), paymentType: "lightning" } as never,
      isSelfCustodial: true,
      paymentDestination: undefined,
      convertMoneyAmount: undefined,
    })
    expect(result.current.isOnchain).toBe(false)
  })

  it("maps each SdkFeeError to its user-facing message", () => {
    const cases: Array<[SdkFeeError, string]> = [
      [SdkFeeError.InsufficientFunds, "Insufficient funds"],
      [SdkFeeError.InvalidInput, "Amount too low"],
      [SdkFeeError.NetworkError, "Network error"],
      [SdkFeeError.Generic, "Generic error"],
    ]

    for (const [err, expected] of cases) {
      mockFeeError = err
      const { result } = renderHook(() =>
        useOnchainFeeTierOptions({
          paymentDetail: null,
          isSelfCustodial: true,
          paymentDestination: undefined,
          convertMoneyAmount: undefined,
        }),
      )
      expect(result.current.feeTierErrorMessage).toBe(expected)
    }
  })

  it("returns no errorMessage when there is no fee error", () => {
    mockFeeError = null
    const { result } = renderHook(() =>
      useOnchainFeeTierOptions({
        paymentDetail: null,
        isSelfCustodial: true,
        paymentDestination: undefined,
        convertMoneyAmount: undefined,
      }),
    )

    expect(result.current.feeTierErrorMessage).toBeUndefined()
  })

  it("setFeeTier updates state but returns null when not onchain", () => {
    const { result } = renderHook(() =>
      useOnchainFeeTierOptions({
        paymentDetail: null,
        isSelfCustodial: true,
        paymentDestination: undefined,
        convertMoneyAmount: undefined,
      }),
    )

    let returned: unknown
    act(() => {
      returned = result.current.setFeeTier(FeeTierOption.Fast, null)
    })
    expect(returned).toBeNull()
    expect(result.current.feeTier).toBe(FeeTierOption.Fast)
  })

  it("setFeeTier rebuilds the payment detail when onchain + destination + convertMoneyAmount available", () => {
    const convertMoneyAmount = jest.fn()
    const { result } = renderHook(() =>
      useOnchainFeeTierOptions({
        paymentDetail: buildOnchainDetail(),
        isSelfCustodial: true,
        paymentDestination: { isValid: true } as never,
        convertMoneyAmount: convertMoneyAmount as never,
      }),
    )

    act(() => {
      result.current.setFeeTier(FeeTierOption.Slow, buildOnchainDetail())
    })

    expect(mockCreatePaymentDetail).toHaveBeenCalled()
    expect(mockSetAmount).toHaveBeenCalled()
    expect(result.current.feeTier).toBe(FeeTierOption.Slow)
  })

  it("setFeeTier returns null when sdk/destination/convertMoneyAmount are missing", () => {
    const { result } = renderHook(() =>
      useOnchainFeeTierOptions({
        paymentDetail: buildOnchainDetail(),
        isSelfCustodial: true,
        paymentDestination: undefined,
        convertMoneyAmount: undefined,
      }),
    )

    let returned: unknown
    act(() => {
      returned = result.current.setFeeTier(FeeTierOption.Fast, buildOnchainDetail())
    })

    expect(returned).toBeNull()
  })

  it("includes feeTierOptions for fast/medium/slow with the formatted sats label", () => {
    const { result } = renderHook(() =>
      useOnchainFeeTierOptions({
        paymentDetail: null,
        isSelfCustodial: true,
        paymentDestination: undefined,
        convertMoneyAmount: undefined,
      }),
    )

    expect(result.current.feeTierOptions).toHaveLength(3)
    expect(result.current.feeTierOptions.map((o) => o.id)).toEqual([
      FeeTierOption.Fast,
      FeeTierOption.Medium,
      FeeTierOption.Slow,
    ])
  })
})
