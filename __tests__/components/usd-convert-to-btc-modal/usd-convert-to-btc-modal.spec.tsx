import React from "react"
import { fireEvent, render } from "@testing-library/react-native"

import { WalletCurrency } from "@app/graphql/generated"
import TypesafeI18n from "@app/i18n/i18n-react"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { toUsdMoneyAmount } from "@app/types/amounts"
import { ThemeProvider } from "@rn-vui/themed"

const mockFormatMoneyAmount = jest.fn(
  ({ moneyAmount }: { moneyAmount: { amount: number; currency: string } }) =>
    `${moneyAmount.currency}:${moneyAmount.amount}`,
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
const mockUseIntraLedgerConversion = jest.fn((_config?: { onSuccess: () => void }) => ({
  execute: mockExecute,
  loading: false,
  errorMessage: undefined as string | undefined,
}))

jest.mock("@app/hooks/use-intra-ledger-conversion", () => ({
  useIntraLedgerConversion: (config: { onSuccess: () => void }) =>
    mockUseIntraLedgerConversion(config),
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

import { UsdConvertToBtcModal } from "@app/components/usd-convert-to-btc-modal"

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
      <UsdConvertToBtcModal
        isVisible={props?.isVisible ?? true}
        toggleModal={props?.toggleModal ?? jest.fn()}
        usdWalletBalance={usdBalance}
        usdWalletId="usd-wallet-id"
        btcWalletId="btc-wallet-id"
      />,
    ),
  )

describe("UsdConvertToBtcModal", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseIntraLedgerConversion.mockReturnValue({
      execute: mockExecute,
      loading: false,
      errorMessage: undefined,
    })
  })

  it("converts the full balance between the account's own wallets on Transfer", () => {
    const { getByText } = renderModal()

    fireEvent.press(getByText("Transfer"))

    expect(mockExecute).toHaveBeenCalledWith({
      fromWallet: { id: "usd-wallet-id", currency: WalletCurrency.Usd },
      toWallet: { id: "btc-wallet-id", currency: WalletCurrency.Btc },
      fromAmount: usdBalance.amount,
    })
  })

  it("renders the error box when the conversion reports an error", () => {
    mockUseIntraLedgerConversion.mockReturnValue({
      execute: mockExecute,
      loading: false,
      errorMessage: "Insufficient balance",
    })

    const { getByText } = renderModal()

    expect(getByText("Insufficient balance")).toBeTruthy()
  })

  it("cannot be dismissed: it renders no close icon", () => {
    const { queryByTestId } = renderModal()

    expect(queryByTestId("icon-close")).toBeNull()
  })

  it("closes only on success: the conversion onSuccess handler is wired to toggleModal", () => {
    const toggleModal = jest.fn()
    renderModal({ toggleModal })

    const { onSuccess } = mockUseIntraLedgerConversion.mock.calls[0][0] as {
      onSuccess: () => void
    }
    onSuccess()

    expect(toggleModal).toHaveBeenCalledTimes(1)
  })
})
