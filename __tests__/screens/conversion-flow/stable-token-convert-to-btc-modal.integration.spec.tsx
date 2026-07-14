import React from "react"
import { fireEvent, render, waitFor } from "@testing-library/react-native"

import TypesafeI18n from "@app/i18n/i18n-react"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { toBtcMoneyAmount, toUsdMoneyAmount } from "@app/types/amounts"
import { PaymentResultStatus } from "@app/types/payment"
import { ThemeProvider } from "@rn-vui/themed"

const mockGetConversionQuote = jest.fn()

jest.mock("@app/hooks/use-payments", () => ({
  usePayments: () => ({ getConversionQuote: mockGetConversionQuote }),
}))

const mockConvertMoneyAmount = jest.fn(
  (moneyAmount: { amount: number }, currency: string) =>
    currency === "BTC"
      ? toBtcMoneyAmount(moneyAmount.amount * 100)
      : toUsdMoneyAmount(moneyAmount.amount),
)

jest.mock("@app/hooks/use-price-conversion", () => ({
  usePriceConversion: () => ({ convertMoneyAmount: mockConvertMoneyAmount }),
}))

jest.mock("@app/hooks/use-display-currency", () => ({
  useDisplayCurrency: () => ({
    formatMoneyAmount: ({ moneyAmount }: { moneyAmount: { amount: number } }) =>
      `$${(moneyAmount.amount / 100).toFixed(2)}`,
  }),
}))

jest.mock("@app/hooks/use-active-wallet", () => ({
  useActiveWallet: () => ({ isReady: true }),
}))

const mockDeactivateStableBalance = jest.fn()

jest.mock("@app/self-custodial/bridge", () => ({
  ...jest.requireActual("@app/self-custodial/bridge"),
  deactivateStableBalance: (...args: readonly unknown[]) =>
    mockDeactivateStableBalance(...args),
}))

const mockRefreshWallets = jest.fn()
const mockRefreshStableBalanceActive = jest.fn()

jest.mock("@app/self-custodial/providers/wallet", () => ({
  useSelfCustodialWallet: () => ({
    sdk: { id: "sdk" },
    refreshWallets: mockRefreshWallets,
    refreshStableBalanceActive: mockRefreshStableBalanceActive,
  }),
}))

jest.mock("@app/utils/error-logging", () => ({
  reportError: jest.fn(),
}))

jest.mock("@app/utils/toast", () => ({
  toastShow: jest.fn(),
}))

jest.mock("@app/utils/analytics", () => ({
  logConversionAttempt: jest.fn(),
  logConversionResult: jest.fn(),
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

const renderModal = (toggleModal: () => void = jest.fn()) =>
  render(
    wrap(
      <StableTokenConvertToBtcModal
        isVisible={true}
        toggleModal={toggleModal}
        usdWalletBalance={usdBalance}
        conversionMinimum={null}
      />,
    ),
  )

describe("StableTokenConvertToBtcModal through the real conversion pipeline", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockDeactivateStableBalance.mockResolvedValue(undefined)
    mockRefreshWallets.mockResolvedValue(undefined)
    mockRefreshStableBalanceActive.mockResolvedValue(undefined)
  })

  it("quotes, converts on Transfer, then closes, deactivates and refreshes in order", async () => {
    const quoteExecute = jest
      .fn()
      .mockResolvedValue({ status: PaymentResultStatus.Success })
    mockGetConversionQuote.mockResolvedValue({
      feeAmount: toUsdMoneyAmount(5),
      execute: quoteExecute,
    })
    const toggleModal = jest.fn()
    const { getByText } = renderModal(toggleModal)

    await waitFor(() => expect(getByText("Transfer")).toBeTruthy())

    fireEvent.press(getByText("Transfer"))

    await waitFor(() => expect(quoteExecute).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(mockRefreshWallets).toHaveBeenCalledTimes(1))
    expect(toggleModal).toHaveBeenCalledTimes(1)
    expect(mockDeactivateStableBalance).toHaveBeenCalledTimes(1)
    expect(mockRefreshStableBalanceActive).toHaveBeenCalledTimes(1)

    const closeOrder = toggleModal.mock.invocationCallOrder[0]
    const deactivateOrder = mockDeactivateStableBalance.mock.invocationCallOrder[0]
    const refreshOrder = mockRefreshWallets.mock.invocationCallOrder[0]
    expect(closeOrder).toBeLessThan(deactivateOrder)
    expect(deactivateOrder).toBeLessThan(refreshOrder)
  })

  it("surfaces a failed quote with an escape hatch, retries and converts with the fresh quote", async () => {
    mockGetConversionQuote.mockRejectedValueOnce(new Error("quote down"))
    const toggleModal = jest.fn()
    const { getByText, getByTestId, queryByText } = renderModal(toggleModal)

    await waitFor(() =>
      expect(getByText("There was an error.\nPlease try again later.")).toBeTruthy(),
    )
    expect(getByTestId("icon-close")).toBeTruthy()

    const quoteExecute = jest
      .fn()
      .mockResolvedValue({ status: PaymentResultStatus.Success })
    mockGetConversionQuote.mockResolvedValue({
      feeAmount: toUsdMoneyAmount(5),
      execute: quoteExecute,
    })

    fireEvent.press(getByText("Transfer"))

    await waitFor(() => expect(mockGetConversionQuote).toHaveBeenCalledTimes(2))
    await waitFor(() =>
      expect(queryByText("There was an error.\nPlease try again later.")).toBeNull(),
    )

    fireEvent.press(getByText("Transfer"))

    await waitFor(() => expect(quoteExecute).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(toggleModal).toHaveBeenCalledTimes(1))
  })
})
