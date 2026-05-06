import React from "react"
import { fireEvent, render } from "@testing-library/react-native"
import { ThemeProvider } from "@rn-vui/themed"

import theme from "@app/rne-theme/theme"
import { UnclaimedDepositsScreen } from "@app/screens/unclaimed-deposits/unclaimed-deposits-screen"
import { SdkFeeError } from "@app/screens/send-bitcoin-screen/hooks/use-onchain-fee-tiers"
import { FeeTierOption } from "@app/screens/send-bitcoin-screen/hooks/fee-tiers.types"
import { DepositStatus, type PendingDeposit } from "@app/types/payment.types"
import { WalletCurrency } from "@app/graphql/generated"

const mockHandleRefund = jest.fn()
const mockHandleClaim = jest.fn()
let mockDeposits: PendingDeposit[] = []
let mockFeeTiers = {
  [FeeTierOption.Fast]: { feeSats: 30, etaMinutes: 10 },
  [FeeTierOption.Medium]: { feeSats: 20, etaMinutes: 30 },
  [FeeTierOption.Slow]: { feeSats: 10, etaMinutes: 60 },
}
let mockFeeTiersError: SdkFeeError | null = null

jest.mock("@app/screens/unclaimed-deposits/hooks/use-deposit-actions", () => ({
  useDepositActions: () => ({
    deposits: mockDeposits,
    isBusy: false,
    isProcessing: () => false,
    handleClaim: mockHandleClaim,
    handleRefund: mockHandleRefund,
    DepositActionType: { Claim: "claim", Refund: "refund" },
  }),
}))

jest.mock("@app/screens/unclaimed-deposits/hooks/use-recommended-fee-tiers", () => {
  const actual = jest.requireActual(
    "@app/screens/unclaimed-deposits/hooks/use-recommended-fee-tiers",
  )
  return {
    ...actual,
    useRecommendedFeeTiers: () => ({
      tiers: mockFeeTiers,
      error: mockFeeTiersError,
    }),
  }
})

jest.mock("@app/self-custodial/providers/wallet-provider", () => ({
  useSelfCustodialWallet: () => ({ sdk: { id: "sdk" } }),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    locale: "en",
    LL: {
      common: { cancel: () => "Cancel" },
      SendBitcoinScreen: {
        fast: () => "Fast",
        medium: () => "Medium",
        slow: () => "Slow",
      },
      UnclaimedDeposit: {
        cardTitle: ({ sats }: { sats: string }) => `Claim ${sats} sats`,
        immature: () => "Waiting for confirmations...",
        claim: () => "Claim now",
        refund: () => "Refund",
        refundAddress: () => "Bitcoin address for refund",
        feeRate: () => "Network fee",
        feeRateUnit: ({ rate }: { rate: number }) => `${rate} sat/vB`,
        feeRateUnavailable: () => "Couldn't load network fees",
        refundNow: () => "Refund now",
        error: () => "Unable to claim this deposit",
        feeExceeded: () => "Fee exceeded",
        belowDustLimit: () => "Below dust",
        missingUtxo: () => "Missing UTXO",
        genericError: () => "Generic",
        claimFailed: () => "Claim failed",
        refundFailed: () => "Refund failed",
      },
    },
  }),
}))

const claimableDeposit: PendingDeposit = {
  id: "deposit-1",
  txid: "abcdef0123456789",
  vout: 0,
  amount: { amount: 10000, currency: WalletCurrency.Btc, currencyCode: "BTC" },
  status: DepositStatus.Claimable,
  errorReason: null,
}

const renderScreen = () =>
  render(
    <ThemeProvider theme={theme}>
      <UnclaimedDepositsScreen />
    </ThemeProvider>,
  )

const enterRefundMode = (utils: ReturnType<typeof renderScreen>) => {
  fireEvent.press(utils.getByTestId(`refund-toggle-${claimableDeposit.id}`))
}

const setAddress = (utils: ReturnType<typeof renderScreen>, address: string) => {
  fireEvent.changeText(utils.getByTestId("refund-address-input"), address)
}

describe("UnclaimedDepositsScreen — refund fee gating (Critical #2)", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockDeposits = [claimableDeposit]
    mockFeeTiers = {
      [FeeTierOption.Fast]: { feeSats: 30, etaMinutes: 10 },
      [FeeTierOption.Medium]: { feeSats: 20, etaMinutes: 30 },
      [FeeTierOption.Slow]: { feeSats: 10, etaMinutes: 60 },
    }
    mockFeeTiersError = null
  })

  it("enables Refund now when address is set, no error, tiers > 0", () => {
    const utils = renderScreen()
    enterRefundMode(utils)
    setAddress(utils, "bc1qaddr")

    const button = utils.getByTestId("refund-now-button")
    expect(button.props.accessibilityState?.disabled).toBe(false)
  })

  it("disables Refund now when fee tiers fetch failed (error surfaced)", () => {
    mockFeeTiersError = SdkFeeError.NetworkError
    const utils = renderScreen()
    enterRefundMode(utils)
    setAddress(utils, "bc1qaddr")

    const button = utils.getByTestId("refund-now-button")
    expect(button.props.accessibilityState?.disabled).toBe(true)
  })

  it("renders feeRateUnavailable message when fee tiers fetch failed", () => {
    mockFeeTiersError = SdkFeeError.NetworkError
    const utils = renderScreen()
    enterRefundMode(utils)

    expect(utils.getByText("Couldn't load network fees")).toBeTruthy()
  })

  it("does NOT render error message when fee tiers loaded successfully", () => {
    const utils = renderScreen()
    enterRefundMode(utils)

    expect(utils.queryByText("Couldn't load network fees")).toBeNull()
  })

  it("disables Refund now when selected tier rate is 0 (regression for Critical #2)", () => {
    mockFeeTiers = {
      [FeeTierOption.Fast]: { feeSats: 0, etaMinutes: 10 },
      [FeeTierOption.Medium]: { feeSats: 0, etaMinutes: 30 },
      [FeeTierOption.Slow]: { feeSats: 0, etaMinutes: 60 },
    }
    const utils = renderScreen()
    enterRefundMode(utils)
    setAddress(utils, "bc1qaddr")

    const button = utils.getByTestId("refund-now-button")
    expect(button.props.accessibilityState?.disabled).toBe(true)
  })

  it("disables Refund now while address is empty even when tiers are valid", () => {
    const utils = renderScreen()
    enterRefundMode(utils)

    const button = utils.getByTestId("refund-now-button")
    expect(button.props.accessibilityState?.disabled).toBe(true)
  })

  it("forwards selected fee rate (medium default) to handleRefund", async () => {
    mockHandleRefund.mockResolvedValue(true)
    const utils = renderScreen()
    enterRefundMode(utils)
    setAddress(utils, "bc1qaddr")

    fireEvent.press(utils.getByTestId("refund-now-button"))

    expect(mockHandleRefund).toHaveBeenCalledWith(
      expect.objectContaining({ id: "deposit-1" }),
      "bc1qaddr",
      20, // medium tier feeSats
    )
  })
})
