import React from "react"
import { act, fireEvent, render } from "@testing-library/react-native"

import TypesafeI18n from "@app/i18n/i18n-react"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { toUsdMoneyAmount } from "@app/types/amounts"
import { ThemeProvider } from "@rn-vui/themed"

const mockFormatMoneyAmount = jest.fn(
  ({
    moneyAmount,
    isApproximate,
  }: {
    moneyAmount: { amount: number; currency: string }
    isApproximate?: boolean
  }) => `${isApproximate ? "~ " : ""}${moneyAmount.currency}:${moneyAmount.amount}`,
)

const mockConvertMoneyAmount = jest.fn((_moneyAmount: unknown, toCurrency: string) => ({
  amount: 129184,
  currency: toCurrency,
  currencyCode: toCurrency,
}))
let mockConvertReady = true

jest.mock("@app/hooks/use-display-currency", () => ({
  useDisplayCurrency: () => ({ formatMoneyAmount: mockFormatMoneyAmount }),
}))

jest.mock("@app/hooks/use-price-conversion", () => ({
  usePriceConversion: () => ({
    convertMoneyAmount: mockConvertReady ? mockConvertMoneyAmount : undefined,
  }),
}))

const mockExecute = jest.fn()
type ConversionParams = { onSuccess: () => Promise<void> }
let mockConversionState: {
  isQuoting: boolean
  hasQuoteError: boolean
  feeText: string
  canExecute: boolean
  execute: jest.Mock
  loading: boolean
  errorMessage?: string
}
const mockUseSelfCustodialConversion = jest.fn(
  (_params: ConversionParams) => mockConversionState,
)

jest.mock("@app/screens/conversion-flow/hooks/self-custodial/use-conversion", () => ({
  useSelfCustodialConversion: (params: ConversionParams) =>
    mockUseSelfCustodialConversion(params),
}))

const mockDeactivateStableBalance = jest.fn()

jest.mock("@app/self-custodial/bridge", () => ({
  ...jest.requireActual("@app/self-custodial/bridge"),
  deactivateStableBalance: (...args: readonly unknown[]) =>
    mockDeactivateStableBalance(...args),
}))

const mockSdk = { id: "sdk" }
const mockRefreshWallets = jest.fn()
const mockRefreshStableBalanceActive = jest.fn()
let mockHasSdk = true

jest.mock("@app/self-custodial/providers/wallet", () => ({
  useSelfCustodialWallet: () => ({
    sdk: mockHasSdk ? mockSdk : null,
    refreshWallets: mockRefreshWallets,
    refreshStableBalanceActive: mockRefreshStableBalanceActive,
  }),
}))

const mockReportError = jest.fn()

jest.mock("@app/utils/error-logging", () => ({
  reportError: (...args: readonly unknown[]) => mockReportError(...args),
}))

jest.mock("react-native-modal", () => {
  const ReactNs = jest.requireActual<typeof import("react")>("react")
  const RN = jest.requireActual<typeof import("react-native")>("react-native")
  const MockModal = ({
    children,
    isVisible,
  }: {
    children: React.ReactNode
    isVisible: boolean
  }) => (isVisible ? ReactNs.createElement(RN.View, null, children) : null)
  return { __esModule: true, default: MockModal }
})

import { StableTokenConvertToBtcModal } from "@app/screens/conversion-flow/stable-token-convert-to-btc-modal"

loadLocale("en")

const usdBalance = toUsdMoneyAmount(10001) // $100.01

const wrap = (ui: React.ReactElement) => (
  <ThemeProvider>
    <TypesafeI18n locale="en">{ui}</TypesafeI18n>
  </ThemeProvider>
)

const renderModal = (props?: { toggleModal?: () => void; isVisible?: boolean }) =>
  render(
    wrap(
      <StableTokenConvertToBtcModal
        isVisible={props?.isVisible ?? true}
        toggleModal={props?.toggleModal ?? jest.fn()}
        usdWalletBalance={usdBalance}
      />,
    ),
  )

const capturedOnSuccess = (): (() => Promise<void>) =>
  mockUseSelfCustodialConversion.mock.calls[0][0].onSuccess

describe("StableTokenConvertToBtcModal", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockHasSdk = true
    mockConvertReady = true
    mockConversionState = {
      isQuoting: false,
      hasQuoteError: false,
      feeText: "",
      canExecute: true,
      execute: mockExecute,
      loading: false,
      errorMessage: undefined,
    }
    mockDeactivateStableBalance.mockResolvedValue(undefined)
    mockRefreshWallets.mockResolvedValue(undefined)
    mockRefreshStableBalanceActive.mockResolvedValue(undefined)
  })

  it("renders the title, body and both amount rows", () => {
    const { getByText } = renderModal()

    expect(getByText("Dollar Balance is not available in your region")).toBeTruthy()
    expect(getByText("Transfer from Dollar Balance to Bitcoin Balance")).toBeTruthy()
    expect(getByText("USD:10001")).toBeTruthy()
    expect(getByText("~ BTC:129184")).toBeTruthy()
  })

  it("wires the full balance into the conversion-flow pipeline", () => {
    renderModal()

    expect(mockUseSelfCustodialConversion).toHaveBeenCalledWith({
      fromCurrency: "USD",
      moneyAmount: usdBalance,
      enabled: true,
      onSuccess: expect.any(Function),
    })
  })

  it("only quotes while the modal is visible", () => {
    renderModal({ isVisible: false })

    expect(mockUseSelfCustodialConversion).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false }),
    )
  })

  it("executes the conversion when Transfer is pressed", () => {
    const { getByText } = renderModal()

    fireEvent.press(getByText("Transfer"))

    expect(mockExecute).toHaveBeenCalledTimes(1)
  })

  it("keeps Transfer disabled until the quote is ready", () => {
    mockConversionState.canExecute = false
    const { getByText } = renderModal()

    fireEvent.press(getByText("Transfer"))

    expect(mockExecute).not.toHaveBeenCalled()
  })

  it("shows the conversion in progress while executing", () => {
    mockConversionState.loading = true
    const { queryByText } = renderModal()

    expect(queryByText("Transfer")).toBeNull()
  })

  it("shows the quote in progress while it loads", () => {
    mockConversionState.isQuoting = true
    mockConversionState.canExecute = false
    const { queryByText } = renderModal()

    expect(queryByText("Transfer")).toBeNull()
  })

  it("surfaces a generic error when the quote fails, instead of a silent dead end", () => {
    mockConversionState.hasQuoteError = true
    mockConversionState.canExecute = false
    const { getByText } = renderModal()

    expect(getByText("There was an error.\nPlease try again later.")).toBeTruthy()
  })

  it("prefers the execution error over the quote error", () => {
    mockConversionState.hasQuoteError = true
    mockConversionState.errorMessage = "Insufficient balance"
    const { getByText, queryByText } = renderModal()

    expect(getByText("Insufficient balance")).toBeTruthy()
    expect(queryByText("There was an error.\nPlease try again later.")).toBeNull()
  })

  it("ignores a second press while the conversion is in flight", () => {
    const { getByText } = renderModal()
    const transferButton = getByText("Transfer")

    fireEvent.press(transferButton)
    fireEvent.press(transferButton)

    expect(mockExecute).toHaveBeenCalledTimes(1)
  })

  it("deactivates the stable balance, refreshes and closes after the conversion succeeds", async () => {
    const toggleModal = jest.fn()
    renderModal({ toggleModal })

    await act(async () => capturedOnSuccess()())

    expect(mockDeactivateStableBalance).toHaveBeenCalledWith(mockSdk)
    expect(mockRefreshStableBalanceActive).toHaveBeenCalledTimes(1)
    expect(mockRefreshWallets).toHaveBeenCalledTimes(1)
    expect(toggleModal).toHaveBeenCalledTimes(1)
  })

  it("still closes when the deactivation fails, because the funds already moved", async () => {
    mockDeactivateStableBalance.mockRejectedValue(new Error("deactivate failed"))
    const toggleModal = jest.fn()
    renderModal({ toggleModal })

    await act(async () => capturedOnSuccess()())

    expect(toggleModal).toHaveBeenCalledTimes(1)
    expect(mockReportError).toHaveBeenCalledWith(
      "Stable token forced conversion deactivate",
      expect.any(Error),
    )
  })

  it("still closes when only the refresh fails", async () => {
    mockRefreshWallets.mockRejectedValue(new Error("refresh failed"))
    const toggleModal = jest.fn()
    renderModal({ toggleModal })

    await act(async () => capturedOnSuccess()())

    expect(toggleModal).toHaveBeenCalledTimes(1)
    expect(mockReportError).toHaveBeenCalledWith(
      "Stable token forced conversion refresh",
      expect.any(Error),
    )
  })

  it("reports instead of rejecting when closing the modal throws", async () => {
    const toggleModal = jest.fn(() => {
      throw new Error("close failed")
    })
    renderModal({ toggleModal })

    await act(async () => capturedOnSuccess()())

    expect(mockReportError).toHaveBeenCalledWith(
      "Stable token forced conversion close",
      expect.any(Error),
    )
  })

  it("skips the deactivation without a connected SDK but still refreshes and closes", async () => {
    mockHasSdk = false
    const toggleModal = jest.fn()
    renderModal({ toggleModal })

    await act(async () => capturedOnSuccess()())

    expect(mockDeactivateStableBalance).not.toHaveBeenCalled()
    expect(mockRefreshWallets).toHaveBeenCalledTimes(1)
    expect(toggleModal).toHaveBeenCalledTimes(1)
  })

  it("renders the error box when the conversion reports an error", () => {
    mockConversionState.errorMessage = "Insufficient balance"
    const { getByText } = renderModal()

    expect(getByText("Insufficient balance")).toBeTruthy()
  })

  it("renders nothing when isVisible is false", () => {
    const { queryByText } = renderModal({ isVisible: false })

    expect(queryByText("Dollar Balance is not available in your region")).toBeNull()
  })

  it("hides the You get estimate while the price conversion is unavailable", () => {
    mockConvertReady = false
    const { getByText, queryByText } = renderModal()

    expect(getByText("You get")).toBeTruthy()
    expect(queryByText("~ BTC:129184")).toBeNull()
  })

  it("cannot be dismissed: it renders no close icon", () => {
    const { queryByTestId } = renderModal()

    expect(queryByTestId("icon-close")).toBeNull()
  })
})
