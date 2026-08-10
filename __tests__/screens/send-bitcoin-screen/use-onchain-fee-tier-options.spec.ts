import { renderHook, act } from "@testing-library/react-native"

import { wrapDestination } from "@app/self-custodial/payment-details/wrap-destination"

import {
  FeeTierOption,
  FeeUnit,
} from "@app/screens/send-bitcoin-screen/hooks/fee-tiers.types"
import { SdkFeeError } from "@app/screens/send-bitcoin-screen/hooks/use-onchain-fee-tiers"
import { useOnchainFeeTierOptions } from "@app/screens/send-bitcoin-screen/hooks/use-onchain-fee-tier-options"
import { PayoutSpeed, WalletCurrency } from "@app/graphql/generated"
import { OnchainFeeQuote } from "@app/screens/send-bitcoin-screen/payment-details/index.types"

const mockSdk = { id: "sdk" } as never
let mockActiveSdk: unknown = mockSdk

let mockFeeTiers = {
  [FeeTierOption.Fast]: { feeAmount: 30, feeUnit: FeeUnit.Sats, etaMinutes: 10 },
  [FeeTierOption.Medium]: { feeAmount: 20, feeUnit: FeeUnit.Sats, etaMinutes: 30 },
  [FeeTierOption.Slow]: { feeAmount: 10, feeUnit: FeeUnit.Sats, etaMinutes: 60 },
}
let mockFeeError: SdkFeeError | null = null
let mockHasSelfCustodialQuote = true

let mockCustodialTiers = {
  [FeeTierOption.Fast]: { feeAmount: 300, feeUnit: FeeUnit.Sats, etaMinutes: 10 },
  [FeeTierOption.Medium]: { feeAmount: 200, feeUnit: FeeUnit.Sats, etaMinutes: 60 },
  [FeeTierOption.Slow]: { feeAmount: 100, feeUnit: FeeUnit.Sats, etaMinutes: 1440 },
}
let mockCustodialHasError = false
let mockCustodialIsQuoting = false
let mockHasCustodialQuote = true
const mockUseCustodialOnchainFeeTiers = jest.fn()

jest.mock("@app/self-custodial/providers/wallet", () => ({
  useSelfCustodialWallet: () => ({ sdk: mockActiveSdk }),
}))

type MockMoneyAmount = { moneyAmount: { amount: number; currency: string } }

let mockDisplayPriceReady = true

jest.mock("@app/hooks/use-display-currency", () => ({
  useDisplayCurrency: () => ({
    formatMoneyAmount: ({ moneyAmount }: MockMoneyAmount) =>
      `${moneyAmount.amount} ${moneyAmount.currency}`,
    /** Tagged so a label built off the raw wallet amount instead shows up in the assert. */
    moneyAmountToDisplayCurrencyString: ({ moneyAmount }: MockMoneyAmount) =>
      mockDisplayPriceReady
        ? `${moneyAmount.amount} ${moneyAmount.currency} display`
        : undefined,
  }),
}))

jest.mock("@app/screens/send-bitcoin-screen/hooks/use-onchain-fee-tiers", () => {
  const actual = jest.requireActual(
    "@app/screens/send-bitcoin-screen/hooks/use-onchain-fee-tiers",
  )
  return {
    ...actual,
    useOnchainFeeTiers: () => ({
      tiers: mockFeeTiers,
      error: mockFeeError,
      hasQuote: mockHasSelfCustodialQuote,
    }),
  }
})

jest.mock(
  "@app/screens/send-bitcoin-screen/hooks/use-custodial-onchain-fee-tiers",
  () => {
    const actual = jest.requireActual(
      "@app/screens/send-bitcoin-screen/hooks/use-custodial-onchain-fee-tiers",
    )
    return {
      ...actual,
      useCustodialOnchainFeeTiers: (params: unknown) => {
        mockUseCustodialOnchainFeeTiers(params)
        return {
          tiers: mockCustodialTiers,
          hasError: mockCustodialHasError,
          hasQuote: mockHasCustodialQuote,
          isQuoting: mockCustodialIsQuoting,
        }
      },
    }
  },
)

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
      SendBitcoinConfirmationScreen: {
        feeError: () => "Unable to calculate fee",
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

const mockSetPayoutSpeed = jest.fn((speed: PayoutSpeed) => ({
  ...buildOnchainDetailRaw(),
  payoutSpeed: speed,
}))

const buildCustodialOnchainDetail = (overrides: Record<string, unknown> = {}) =>
  ({
    ...buildOnchainDetailRaw(),
    payoutSpeed: PayoutSpeed.Fast,
    feeQuote: OnchainFeeQuote.Btc,
    setPayoutSpeed: mockSetPayoutSpeed,
    ...overrides,
  }) as never

describe("useOnchainFeeTierOptions", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockActiveSdk = mockSdk
    mockDisplayPriceReady = true
    mockFeeError = null
    mockHasSelfCustodialQuote = true
    mockHasCustodialQuote = true
    mockCustodialHasError = false
    mockCustodialIsQuoting = false
    mockFeeTiers = {
      [FeeTierOption.Fast]: { feeAmount: 30, feeUnit: FeeUnit.Sats, etaMinutes: 10 },
      [FeeTierOption.Medium]: { feeAmount: 20, feeUnit: FeeUnit.Sats, etaMinutes: 30 },
      [FeeTierOption.Slow]: { feeAmount: 10, feeUnit: FeeUnit.Sats, etaMinutes: 60 },
    }
    mockCustodialTiers = {
      [FeeTierOption.Fast]: { feeAmount: 300, feeUnit: FeeUnit.Sats, etaMinutes: 10 },
      [FeeTierOption.Medium]: { feeAmount: 200, feeUnit: FeeUnit.Sats, etaMinutes: 60 },
      [FeeTierOption.Slow]: { feeAmount: 100, feeUnit: FeeUnit.Sats, etaMinutes: 1440 },
    }
  })

  it("starts self-custodial on Medium, matching the SDK wrapper default", () => {
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

  it("starts custodial on Fast, matching the schema default the mutation would use", () => {
    const { result } = renderHook(() =>
      useOnchainFeeTierOptions({
        paymentDetail: null,
        isSelfCustodial: false,
        paymentDestination: undefined,
        convertMoneyAmount: undefined,
      }),
    )

    expect(result.current.feeTier).toBe(FeeTierOption.Fast)
  })

  it("follows the rail once isSelfCustodial resolves after the first render", () => {
    const { result, rerender } = renderHook(
      (props: Parameters<typeof useOnchainFeeTierOptions>[0]) =>
        useOnchainFeeTierOptions(props),
      {
        // The wallet is still initializing here, so isSelfCustodial reads false.
        initialProps: {
          paymentDetail: null,
          isSelfCustodial: false,
          paymentDestination: undefined,
          convertMoneyAmount: undefined,
        },
      },
    )

    expect(result.current.feeTier).toBe(FeeTierOption.Fast)

    rerender({
      paymentDetail: null,
      isSelfCustodial: true,
      paymentDestination: undefined,
      convertMoneyAmount: undefined,
    })

    expect(result.current.feeTier).toBe(FeeTierOption.Medium)
  })

  it("keeps an explicit choice when the rail resolves afterwards", () => {
    const { result, rerender } = renderHook(
      (props: Parameters<typeof useOnchainFeeTierOptions>[0]) =>
        useOnchainFeeTierOptions(props),
      {
        initialProps: {
          paymentDetail: null,
          isSelfCustodial: false,
          paymentDestination: undefined,
          convertMoneyAmount: undefined,
        },
      },
    )

    act(() => {
      result.current.setFeeTier(FeeTierOption.Slow, null)
    })

    rerender({
      paymentDetail: null,
      isSelfCustodial: true,
      paymentDestination: undefined,
      convertMoneyAmount: undefined,
    })

    expect(result.current.feeTier).toBe(FeeTierOption.Slow)
  })

  it("isOnchain follows the payment type for both custodial and self-custodial", () => {
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
      paymentDetail: buildCustodialOnchainDetail(),
      isSelfCustodial: false,
      paymentDestination: undefined,
      convertMoneyAmount: undefined,
    })
    expect(result.current.isOnchain).toBe(true)

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

  it("labels the tiers off the wallet amount while the display price is loading", () => {
    mockDisplayPriceReady = false

    const { result } = renderHook(() =>
      useOnchainFeeTierOptions({
        paymentDetail: buildOnchainDetailRaw() as never,
        isSelfCustodial: true,
        paymentDestination: undefined,
        convertMoneyAmount: undefined,
      }),
    )

    // No "display" tag: the price is not there yet, so the raw wallet amount stands in.
    expect(result.current.feeTierOptions[0].label).toBe("Fast (30 BTC)")
  })

  it("formats self-custodial fees in sats even when the usd wallet is sending", () => {
    const { result } = renderHook(() =>
      useOnchainFeeTierOptions({
        paymentDetail: {
          ...buildOnchainDetailRaw(),
          sendingWalletDescriptor: { currency: WalletCurrency.Usd, id: "usd-w" },
        } as never,
        isSelfCustodial: true,
        paymentDestination: undefined,
        convertMoneyAmount: undefined,
      }),
    )

    // The SDK quotes in sats regardless of wallet, so 30 must not be read as 30 cents.
    expect(result.current.feeTierOptions[0].label).toBe("Fast (30 BTC display)")
  })

  it("blocks the send only when the self-custodial quote failed", () => {
    const { result: selfCustodial } = renderHook(() =>
      useOnchainFeeTierOptions({
        paymentDetail: buildOnchainDetail(),
        isSelfCustodial: true,
        paymentDestination: undefined,
        convertMoneyAmount: undefined,
      }),
    )
    expect(selfCustodial.current.isFeeTierErrorBlocking).toBe(false)

    mockFeeError = SdkFeeError.NetworkError
    const { result: selfCustodialFailed } = renderHook(() =>
      useOnchainFeeTierOptions({
        paymentDetail: buildOnchainDetail(),
        isSelfCustodial: true,
        paymentDestination: undefined,
        convertMoneyAmount: undefined,
      }),
    )
    expect(selfCustodialFailed.current.isFeeTierErrorBlocking).toBe(true)
  })

  it("shows a custodial quote failure without blocking the send", () => {
    mockCustodialHasError = true
    const { result } = renderHook(() =>
      useOnchainFeeTierOptions({
        paymentDetail: buildCustodialOnchainDetail(),
        isSelfCustodial: false,
        paymentDestination: undefined,
        convertMoneyAmount: undefined,
      }),
    )

    expect(result.current.feeTierErrorMessage).toBe("Unable to calculate fee")
    expect(result.current.isFeeTierErrorBlocking).toBe(false)
  })

  it("ignores a self-custodial fee error while on a custodial account", () => {
    mockFeeError = SdkFeeError.NetworkError
    const { result } = renderHook(() =>
      useOnchainFeeTierOptions({
        paymentDetail: buildCustodialOnchainDetail(),
        isSelfCustodial: false,
        paymentDestination: undefined,
        convertMoneyAmount: undefined,
      }),
    )

    expect(result.current.feeTierErrorMessage).toBeUndefined()
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

  it("returns the rebuilt detail without an amount when none has been entered yet", () => {
    const amountless = {
      ...buildOnchainDetailRaw(),
      unitOfAccountAmount: {
        amount: 0,
        currency: WalletCurrency.Btc,
        currencyCode: "BTC",
      },
    } as never

    const { result } = renderHook(() =>
      useOnchainFeeTierOptions({
        paymentDetail: amountless,
        isSelfCustodial: true,
        paymentDestination: { isValid: true } as never,
        convertMoneyAmount: jest.fn() as never,
      }),
    )

    let returned: unknown
    act(() => {
      returned = result.current.setFeeTier(FeeTierOption.Slow, amountless)
    })

    expect(mockCreatePaymentDetail).toHaveBeenCalled()
    expect(mockSetAmount).not.toHaveBeenCalled()
    expect((returned as { paymentType?: string }).paymentType).toBe("onchain")
  })

  it("returns null when the detail handed in is no longer an on-chain payment", () => {
    const { result } = renderHook(() =>
      useOnchainFeeTierOptions({
        paymentDetail: buildOnchainDetail(),
        isSelfCustodial: true,
        paymentDestination: { isValid: true } as never,
        convertMoneyAmount: jest.fn() as never,
      }),
    )

    let returned: unknown
    act(() => {
      returned = result.current.setFeeTier(FeeTierOption.Slow, {
        ...buildOnchainDetailRaw(),
        paymentType: "lightning",
      } as never)
    })

    expect(returned).toBeNull()
    expect(mockCreatePaymentDetail).not.toHaveBeenCalled()
  })

  it("returns null when the sdk is not ready", () => {
    mockActiveSdk = null
    const { result } = renderHook(() =>
      useOnchainFeeTierOptions({
        paymentDetail: buildOnchainDetail(),
        isSelfCustodial: true,
        paymentDestination: { isValid: true } as never,
        convertMoneyAmount: jest.fn() as never,
      }),
    )

    let returned: unknown
    act(() => {
      returned = result.current.setFeeTier(FeeTierOption.Slow, buildOnchainDetail())
    })

    expect(returned).toBeNull()
  })

  it("returns null when the destination no longer wraps into a payment detail", () => {
    jest.mocked(wrapDestination).mockReturnValueOnce({ valid: false } as never)

    const { result } = renderHook(() =>
      useOnchainFeeTierOptions({
        paymentDetail: buildOnchainDetail(),
        isSelfCustodial: true,
        paymentDestination: { isValid: true } as never,
        convertMoneyAmount: jest.fn() as never,
      }),
    )

    let returned: unknown
    act(() => {
      returned = result.current.setFeeTier(FeeTierOption.Slow, buildOnchainDetail())
    })

    expect(returned).toBeNull()
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

  it("leaves the selector on the applied tier when the rebuild fails", () => {
    const { result } = renderHook(() =>
      useOnchainFeeTierOptions({
        paymentDetail: buildOnchainDetail(),
        isSelfCustodial: true,
        paymentDestination: undefined,
        convertMoneyAmount: undefined,
      }),
    )

    const tierBefore = result.current.feeTier
    act(() => {
      result.current.setFeeTier(FeeTierOption.Slow, buildOnchainDetail())
    })

    // Showing Slow here would claim a speed the payment detail never took on.
    expect(result.current.feeTier).toBe(tierBefore)
  })

  it("still remembers the choice while there is no payment to rebuild", () => {
    const { result } = renderHook(() =>
      useOnchainFeeTierOptions({
        paymentDetail: null,
        isSelfCustodial: true,
        paymentDestination: undefined,
        convertMoneyAmount: undefined,
      }),
    )

    act(() => {
      result.current.setFeeTier(FeeTierOption.Slow, null)
    })

    expect(result.current.feeTier).toBe(FeeTierOption.Slow)
  })

  describe("custodial tier selection", () => {
    it("maps each tier onto its payout speed and returns the rebuilt detail", () => {
      const cases: Array<[FeeTierOption, PayoutSpeed]> = [
        [FeeTierOption.Fast, PayoutSpeed.Fast],
        [FeeTierOption.Medium, PayoutSpeed.Medium],
        [FeeTierOption.Slow, PayoutSpeed.Slow],
      ]

      for (const [tier, expectedSpeed] of cases) {
        mockSetPayoutSpeed.mockClear()
        const { result } = renderHook(() =>
          useOnchainFeeTierOptions({
            paymentDetail: buildCustodialOnchainDetail(),
            isSelfCustodial: false,
            paymentDestination: undefined,
            convertMoneyAmount: undefined,
          }),
        )

        let returned: unknown
        act(() => {
          returned = result.current.setFeeTier(tier, buildCustodialOnchainDetail())
        })

        expect(mockSetPayoutSpeed).toHaveBeenCalledWith(expectedSpeed)
        expect((returned as { payoutSpeed?: PayoutSpeed }).payoutSpeed).toBe(
          expectedSpeed,
        )
        expect(result.current.feeTier).toBe(tier)
      }
    })

    it("never rebuilds through the self-custodial wrapper", () => {
      const { result } = renderHook(() =>
        useOnchainFeeTierOptions({
          paymentDetail: buildCustodialOnchainDetail(),
          isSelfCustodial: false,
          paymentDestination: { isValid: true } as never,
          convertMoneyAmount: jest.fn() as never,
        }),
      )

      act(() => {
        result.current.setFeeTier(FeeTierOption.Slow, buildCustodialOnchainDetail())
      })

      expect(mockCreatePaymentDetail).not.toHaveBeenCalled()
    })

    it("returns null when the detail predates payout speed support", () => {
      const { result } = renderHook(() =>
        useOnchainFeeTierOptions({
          paymentDetail: buildOnchainDetail(),
          isSelfCustodial: false,
          paymentDestination: undefined,
          convertMoneyAmount: undefined,
        }),
      )

      let returned: unknown
      act(() => {
        returned = result.current.setFeeTier(FeeTierOption.Slow, buildOnchainDetail())
      })

      expect(returned).toBeNull()
    })

    it("quotes through the endpoint the payment detail declares", () => {
      renderHook(() =>
        useOnchainFeeTierOptions({
          paymentDetail: buildCustodialOnchainDetail({
            sendingWalletDescriptor: { currency: WalletCurrency.Usd, id: "usd-w" },
            feeQuote: OnchainFeeQuote.UsdAsBtcDenominated,
            settlementAmount: {
              amount: 5000,
              currency: WalletCurrency.Usd,
              currencyCode: "USD",
            },
          }),
          isSelfCustodial: false,
          paymentDestination: undefined,
          convertMoneyAmount: undefined,
        }),
      )

      // The rule itself lives in the payment-detail factories; this layer only forwards it.
      expect(mockUseCustodialOnchainFeeTiers).toHaveBeenCalledWith(
        expect.objectContaining({
          quote: OnchainFeeQuote.UsdAsBtcDenominated,
          walletId: "usd-w",
          amount: 5000,
        }),
      )
    })

    it("quotes the destination-specified amount rather than the settled one", () => {
      renderHook(() =>
        useOnchainFeeTierOptions({
          paymentDetail: buildCustodialOnchainDetail({
            sendingWalletDescriptor: { currency: WalletCurrency.Usd, id: "usd-w" },
            feeQuote: OnchainFeeQuote.UsdAsBtcDenominated,
            destinationSpecifiedAmount: {
              amount: 5000,
              currency: WalletCurrency.Btc,
              currencyCode: "BTC",
            },
            settlementAmount: {
              amount: 320,
              currency: WalletCurrency.Usd,
              currencyCode: "USD",
            },
          }),
          isSelfCustodial: false,
          paymentDestination: undefined,
          convertMoneyAmount: undefined,
        }),
      )

      // A BIP21 amount is sats and this endpoint takes SatAmount, so forwarding the
      // wallet's cents would quote a different transaction than the one that broadcasts.
      expect(mockUseCustodialOnchainFeeTiers).toHaveBeenCalledWith(
        expect.objectContaining({
          quote: OnchainFeeQuote.UsdAsBtcDenominated,
          amount: 5000,
        }),
      )
    })

    it("does not quote custodial fees while on a self-custodial account", () => {
      renderHook(() =>
        useOnchainFeeTierOptions({
          paymentDetail: buildOnchainDetail(),
          isSelfCustodial: true,
          paymentDestination: undefined,
          convertMoneyAmount: undefined,
        }),
      )

      expect(mockUseCustodialOnchainFeeTiers).toHaveBeenCalledWith(
        expect.objectContaining({ walletId: undefined, address: undefined }),
      )
    })
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

  it("reports quoting only while the custodial rail is fetching", () => {
    mockCustodialIsQuoting = true

    const { result: custodial } = renderHook(() =>
      useOnchainFeeTierOptions({
        paymentDetail: buildCustodialOnchainDetail(),
        isSelfCustodial: false,
        paymentDestination: undefined,
        convertMoneyAmount: undefined,
      }),
    )
    expect(custodial.current.isQuotingFees).toBe(true)

    // The SDK answers locally, so a self-custodial send never shows the spinner.
    const { result: selfCustodial } = renderHook(() =>
      useOnchainFeeTierOptions({
        paymentDetail: buildOnchainDetail(),
        isSelfCustodial: true,
        paymentDestination: undefined,
        convertMoneyAmount: undefined,
      }),
    )
    expect(selfCustodial.current.isQuotingFees).toBe(false)
  })

  it("labels custodial options from the custodial quote, not the SDK one", () => {
    const { result } = renderHook(() =>
      useOnchainFeeTierOptions({
        paymentDetail: buildCustodialOnchainDetail(),
        isSelfCustodial: false,
        paymentDestination: undefined,
        convertMoneyAmount: undefined,
      }),
    )

    expect(result.current.feeTierOptions.map((o) => o.label)).toEqual([
      "Fast (300 BTC display)",
      "Medium (200 BTC display)",
      "Slow (100 BTC display)",
    ])
  })
})
