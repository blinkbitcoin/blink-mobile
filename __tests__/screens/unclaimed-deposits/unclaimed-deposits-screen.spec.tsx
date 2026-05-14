import React from "react"
import { fireEvent, render } from "@testing-library/react-native"
import { ThemeProvider } from "@rn-vui/themed"

import theme from "@app/rne-theme/theme"
import { UnclaimedDepositsScreen } from "@app/screens/unclaimed-deposits/unclaimed-deposits-screen"
import { SdkFeeError } from "@app/screens/send-bitcoin-screen/hooks/use-onchain-fee-tiers"
import { FeeTierOption } from "@app/screens/send-bitcoin-screen/hooks/fee-tiers.types"
import { DepositStatus, type PendingDeposit } from "@app/types/payment"
import { WalletCurrency } from "@app/graphql/generated"

const mockHandleRefund = jest.fn()
const mockHandleClaim = jest.fn()
const mockOpenMempoolTx = jest.fn()
let mockDeposits: PendingDeposit[] = []
let mockIsBusy = false
let mockIsProcessing: (id: string, action: string) => boolean = () => false
let mockFeeTiers = {
  [FeeTierOption.Fast]: { feeSats: 30, etaMinutes: 10 },
  [FeeTierOption.Medium]: { feeSats: 20, etaMinutes: 30 },
  [FeeTierOption.Slow]: { feeSats: 10, etaMinutes: 60 },
}
let mockFeeTiersError: SdkFeeError | null = null

jest.mock("@app/screens/unclaimed-deposits/hooks/use-deposit-actions", () => ({
  useDepositActions: () => ({
    deposits: mockDeposits,
    isBusy: mockIsBusy,
    isProcessing: (id: string, action: string) => mockIsProcessing(id, action),
    handleClaim: mockHandleClaim,
    handleRefund: mockHandleRefund,
    DepositActionType: { Claim: "claim", Refund: "refund" },
  }),
}))

jest.mock("@app/screens/unclaimed-deposits/utils", () => ({
  openMempoolTx: (...args: unknown[]) => mockOpenMempoolTx(...args),
  ADDRESS_PLACEHOLDER: "bc1q...",
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

jest.mock("@app/self-custodial/providers/wallet", () => ({
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

describe("UnclaimedDepositsScreen — refund fee gating", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockDeposits = [claimableDeposit]
    mockIsBusy = false
    mockIsProcessing = () => false
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

  it("disables Refund now when selected tier rate is 0 (regression)", () => {
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

describe("UnclaimedDepositsScreen — broader flows", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockDeposits = [claimableDeposit]
    mockIsBusy = false
    mockIsProcessing = () => false
    mockFeeTiers = {
      [FeeTierOption.Fast]: { feeSats: 30, etaMinutes: 10 },
      [FeeTierOption.Medium]: { feeSats: 20, etaMinutes: 30 },
      [FeeTierOption.Slow]: { feeSats: 10, etaMinutes: 60 },
    }
    mockFeeTiersError = null
  })

  it("renders empty-state copy when there are no deposits", () => {
    mockDeposits = []
    const { getByText, queryByTestId } = renderScreen()

    expect(getByText("Unable to claim this deposit")).toBeTruthy()
    expect(queryByTestId("claim-deposit-1")).toBeNull()
  })

  it("calls handleClaim with the deposit when Claim is pressed", () => {
    const utils = renderScreen()

    fireEvent.press(utils.getByTestId(`claim-${claimableDeposit.id}`))

    expect(mockHandleClaim).toHaveBeenCalledWith(
      expect.objectContaining({ id: claimableDeposit.id }),
    )
  })

  it("opens the mempool tx URL when the txid row is pressed", () => {
    const utils = renderScreen()

    fireEvent.press(utils.getByText(claimableDeposit.txid))

    expect(mockOpenMempoolTx).toHaveBeenCalledWith(claimableDeposit.txid)
  })

  it("shows the immature copy and hides claim/refund actions for Immature deposits", () => {
    mockDeposits = [{ ...claimableDeposit, status: DepositStatus.Immature }]
    const utils = renderScreen()

    expect(utils.getByText("Waiting for confirmations...")).toBeTruthy()
    expect(utils.queryByTestId(`claim-${claimableDeposit.id}`)).toBeNull()
    expect(utils.queryByTestId(`refund-toggle-${claimableDeposit.id}`)).toBeNull()
  })

  it("renders the claim spinner instead of the Claim button while a claim is in flight", () => {
    mockIsProcessing = (_id, action) => action === "claim"
    const utils = renderScreen()

    expect(utils.queryByTestId(`claim-${claimableDeposit.id}`)).toBeNull()
    expect(utils.queryByTestId(`refund-toggle-${claimableDeposit.id}`)).toBeTruthy()
  })

  it("renders the refund spinner instead of Refund now while a refund is in flight", () => {
    mockIsProcessing = (_id, action) => action === "refund"
    const utils = renderScreen()
    enterRefundMode(utils)

    expect(utils.queryByTestId("refund-now-button")).toBeNull()
    expect(utils.queryByTestId("cancel-refund")).toBeTruthy()
  })

  it("disables the Claim button when isBusy is true", () => {
    mockIsBusy = true
    const utils = renderScreen()

    const claimBtn = utils.getByTestId(`claim-${claimableDeposit.id}`)
    expect(claimBtn.props.accessibilityState?.disabled).toBe(true)
  })

  it("exits refund mode when Cancel is pressed", () => {
    const utils = renderScreen()
    enterRefundMode(utils)

    expect(utils.queryByTestId("refund-now-button")).toBeTruthy()

    fireEvent.press(utils.getByTestId("cancel-refund"))

    expect(utils.queryByTestId("refund-now-button")).toBeNull()
    expect(utils.queryByTestId(`refund-toggle-${claimableDeposit.id}`)).toBeTruthy()
  })

  it("hides the Claim button on the card currently in refund mode", () => {
    const utils = renderScreen()
    enterRefundMode(utils)

    expect(utils.queryByTestId(`claim-${claimableDeposit.id}`)).toBeNull()
  })
})
