import React from "react"
import { act, fireEvent, render } from "@testing-library/react-native"

import TypesafeI18n from "@app/i18n/i18n-react"
import { i18nObject } from "@app/i18n/i18n-util"
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

jest.mock("@app/hooks/use-display-currency", () => ({
  useDisplayCurrency: () => ({ formatMoneyAmount: mockFormatMoneyAmount }),
}))

jest.mock("@app/hooks/use-price-conversion", () => ({
  usePriceConversion: () => ({ convertMoneyAmount: mockConvertMoneyAmount }),
}))

const mockExecute = jest.fn()
const mockRequote = jest.fn()
type ConversionParams = { onSuccess: () => Promise<void> }
let mockConversionState: {
  isQuoting: boolean
  hasQuoteError: boolean
  feeText: string
  canExecute: boolean
  execute: jest.Mock
  requote: jest.Mock
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

let mockIsWalletReady = true

jest.mock("@app/hooks/use-active-wallet", () => ({
  useActiveWallet: () => ({ isReady: mockIsWalletReady }),
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

const mockToastShow = jest.fn()

jest.mock("@app/utils/toast", () => ({
  toastShow: (...args: readonly unknown[]) => mockToastShow(...args),
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

const renderModal = (props?: {
  toggleModal?: () => void
  isVisible?: boolean
  conversionMinimum?: number | null
}) =>
  render(
    wrap(
      <StableTokenConvertToBtcModal
        isVisible={props?.isVisible ?? true}
        toggleModal={props?.toggleModal ?? jest.fn()}
        usdWalletBalance={usdBalance}
        conversionMinimum={props?.conversionMinimum ?? null}
      />,
    ),
  )

const capturedOnSuccess = (): (() => Promise<void>) =>
  mockUseSelfCustodialConversion.mock.calls[0][0].onSuccess

describe("StableTokenConvertToBtcModal", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockHasSdk = true
    mockIsWalletReady = true
    mockConversionState = {
      isQuoting: false,
      hasQuoteError: false,
      feeText: "",
      canExecute: true,
      execute: mockExecute,
      requote: mockRequote,
      loading: false,
      errorMessage: undefined,
    }
    mockDeactivateStableBalance.mockResolvedValue(undefined)
    mockRefreshWallets.mockResolvedValue(undefined)
    mockRefreshStableBalanceActive.mockResolvedValue(undefined)
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

  it("waits for the wallet startup sync before quoting", () => {
    mockIsWalletReady = false
    renderModal()

    expect(mockUseSelfCustodialConversion).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false }),
    )
  })

  it("does not quote a transient zero balance", () => {
    render(
      wrap(
        <StableTokenConvertToBtcModal
          isVisible={true}
          toggleModal={jest.fn()}
          usdWalletBalance={toUsdMoneyAmount(0)}
          conversionMinimum={null}
        />,
      ),
    )

    expect(mockUseSelfCustodialConversion).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false }),
    )
  })

  it("executes the conversion when Transfer is pressed", () => {
    const { getByText } = renderModal()

    fireEvent.press(getByText("Transfer"))

    expect(mockExecute).toHaveBeenCalledTimes(1)
    expect(mockRequote).not.toHaveBeenCalled()
  })

  it("stays busy and locked while no quote is executable yet, so the forced conversion cannot be skipped", () => {
    mockConversionState.canExecute = false
    mockConversionState.hasQuoteError = false
    const { queryByText, queryByTestId } = renderModal()

    expect(queryByText("Transfer")).toBeNull()
    expect(queryByTestId("icon-close")).toBeNull()
  })

  it("shows the conversion in progress while executing", () => {
    mockConversionState.loading = true
    const { queryByText } = renderModal()

    expect(queryByText("Transfer")).toBeNull()
  })

  it("recovers from a failed quote: shows the error, allows dismissing and retries", () => {
    mockConversionState.hasQuoteError = true
    mockConversionState.canExecute = false
    const { getByText, getByTestId } = renderModal()

    expect(getByText("There was an error.\nPlease try again later.")).toBeTruthy()
    expect(getByTestId("icon-close")).toBeTruthy()

    fireEvent.press(getByText("Transfer"))

    expect(mockRequote).toHaveBeenCalledTimes(1)
    expect(mockExecute).not.toHaveBeenCalled()
  })

  it("locks the modal while the quote has not failed", () => {
    const { queryByTestId } = renderModal()

    expect(queryByTestId("icon-close")).toBeNull()
  })

  it("shows the minimum transfer amount when the quote fails below the minimum", () => {
    mockConversionState.hasQuoteError = true
    mockConversionState.canExecute = false
    const { getByText } = renderModal({ conversionMinimum: 20000 })

    expect(getByText("Minimum transfer: USD:20000")).toBeTruthy()
  })

  it("keeps the generic quote error when the balance meets the minimum", () => {
    mockConversionState.hasQuoteError = true
    mockConversionState.canExecute = false
    const { getByText } = renderModal({ conversionMinimum: 500 })

    expect(getByText("There was an error.\nPlease try again later.")).toBeTruthy()
  })

  it("prefers the execution error over the quote error", () => {
    mockConversionState.hasQuoteError = true
    mockConversionState.errorMessage = "Insufficient balance"
    const { getByText, queryByText } = renderModal()

    expect(getByText("Insufficient balance")).toBeTruthy()
    expect(queryByText("There was an error.\nPlease try again later.")).toBeNull()
  })

  it("closes before deactivating and refreshing after the conversion succeeds", async () => {
    const toggleModal = jest.fn()
    renderModal({ toggleModal })

    await act(async () => capturedOnSuccess()())

    expect(toggleModal).toHaveBeenCalledTimes(1)
    expect(mockDeactivateStableBalance).toHaveBeenCalledWith(mockSdk)
    expect(mockRefreshStableBalanceActive).toHaveBeenCalledTimes(1)
    expect(mockRefreshWallets).toHaveBeenCalledTimes(1)

    const closeOrder = toggleModal.mock.invocationCallOrder[0]
    const deactivateOrder = mockDeactivateStableBalance.mock.invocationCallOrder[0]
    const refreshOrder = mockRefreshWallets.mock.invocationCallOrder[0]
    expect(closeOrder).toBeLessThan(deactivateOrder)
    expect(deactivateOrder).toBeLessThan(refreshOrder)
  })

  it("warns with a toast and still refreshes when the deactivation fails", async () => {
    mockDeactivateStableBalance.mockRejectedValue(new Error("deactivate failed"))
    const toggleModal = jest.fn()
    renderModal({ toggleModal })

    await act(async () => capturedOnSuccess()())

    expect(toggleModal).toHaveBeenCalledTimes(1)
    expect(mockToastShow).toHaveBeenCalledTimes(1)
    const toastMessage = mockToastShow.mock.calls[0][0].message
    expect(toastMessage(i18nObject("en"))).toBe(
      "Could not update Stable Balance. Please try again.",
    )
    expect(mockRefreshStableBalanceActive).toHaveBeenCalledTimes(1)
    expect(mockRefreshWallets).toHaveBeenCalledTimes(1)
    expect(mockReportError).toHaveBeenCalledWith(
      "Stable Balance deactivate",
      expect.any(Error),
    )
  })

  it("only reports when the refresh fails, because the modal already closed", async () => {
    mockRefreshWallets.mockRejectedValue(new Error("refresh failed"))
    const toggleModal = jest.fn()
    renderModal({ toggleModal })

    await act(async () => capturedOnSuccess()())

    expect(toggleModal).toHaveBeenCalledTimes(1)
    expect(mockReportError).toHaveBeenCalledWith(
      "Stable Balance refresh",
      expect.any(Error),
    )
  })

  it("skips the deactivation and refresh without a connected SDK but still closes", async () => {
    mockHasSdk = false
    const toggleModal = jest.fn()
    renderModal({ toggleModal })

    await act(async () => capturedOnSuccess()())

    expect(mockDeactivateStableBalance).not.toHaveBeenCalled()
    expect(toggleModal).toHaveBeenCalledTimes(1)
    expect(mockRefreshWallets).not.toHaveBeenCalled()
  })
})
