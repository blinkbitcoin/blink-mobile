import React from "react"
import { render, fireEvent } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import WalletOverview from "@app/components/wallet-overview/wallet-overview"
import { WalletCurrency } from "@app/graphql/generated"
import { ContextForScreen } from "../../screens/helper"

const mockNavigate = jest.fn()
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate }),
}))

jest.mock("@app/hooks/use-display-currency", () => ({
  useDisplayCurrency: () => ({
    formatMoneyAmount: () => "0 sat",
    displayCurrency: "USD",
    moneyAmountToDisplayCurrencyString: () => "~ $0.00",
  }),
}))

jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useWalletOverviewScreenQuery: () => ({ data: undefined }),
}))

const mockUseHideAmount = jest.fn()
jest.mock("@app/graphql/hide-amount-context", () => ({
  useHideAmount: () => mockUseHideAmount(),
}))

const mockWallets = [
  { id: "btc-1", balance: 0, walletCurrency: WalletCurrency.Btc },
  { id: "usd-1", balance: 0, walletCurrency: WalletCurrency.Usd },
]

const defaultProps = {
  loading: false,
  setIsStablesatModalVisible: jest.fn(),
  wallets: mockWallets,
}

describe("WalletOverview — card row", () => {
  beforeEach(() => {
    loadLocale("en")
    jest.clearAllMocks()
    mockUseHideAmount.mockReturnValue({
      hideAmount: false,
      switchMemoryHideAmount: jest.fn(),
    })
  })

  it("does not render card row when showCardRow is false", () => {
    const { queryByText } = render(
      <ContextForScreen>
        <WalletOverview
          {...defaultProps}
          showCardRow={false}
          cardBalancePrimary="~ $100.00"
          cardBalanceSecondary="0.0015 BTC"
        />
      </ContextForScreen>,
    )

    expect(queryByText("~ $100.00")).toBeNull()
    expect(queryByText("0.0015 BTC")).toBeNull()
  })

  it("does not render card row by default", () => {
    const { queryByText } = render(
      <ContextForScreen>
        <WalletOverview
          {...defaultProps}
          cardBalancePrimary="~ $100.00"
          cardBalanceSecondary="0.0015 BTC"
        />
      </ContextForScreen>,
    )

    expect(queryByText("~ $100.00")).toBeNull()
  })

  it("renders card row when showCardRow is true", () => {
    const { getByText } = render(
      <ContextForScreen>
        <WalletOverview
          {...defaultProps}
          showCardRow={true}
          cardBalancePrimary="~ $100.00"
          cardBalanceSecondary="0.0015 BTC"
        />
      </ContextForScreen>,
    )

    expect(getByText("0.0015 BTC")).toBeTruthy()
    expect(getByText("~ $100.00")).toBeTruthy()
  })

  it("navigates to cardDashboardScreen when card row is pressed", () => {
    const { getByText } = render(
      <ContextForScreen>
        <WalletOverview
          {...defaultProps}
          showCardRow={true}
          cardBalancePrimary="~ $100.00"
          cardBalanceSecondary="0.0015 BTC"
        />
      </ContextForScreen>,
    )

    fireEvent.press(getByText("0.0015 BTC"))

    expect(mockNavigate).toHaveBeenCalledWith("cardDashboardScreen")
  })

  it("shows hidden amount placeholder on card row when hideAmount is enabled", () => {
    mockUseHideAmount.mockReturnValue({
      hideAmount: true,
      switchMemoryHideAmount: jest.fn(),
    })

    const { getAllByText, queryByText } = render(
      <ContextForScreen>
        <WalletOverview
          {...defaultProps}
          showCardRow={true}
          cardBalancePrimary="~ $100.00"
          cardBalanceSecondary="0.0015 BTC"
        />
      </ContextForScreen>,
    )

    expect(getAllByText("****").length).toBeGreaterThan(0)
    expect(queryByText("~ $100.00")).toBeNull()
    expect(queryByText("0.0015 BTC")).toBeNull()
  })
})
