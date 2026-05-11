import React from "react"
import { render, fireEvent } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import WalletOverview from "@app/components/wallet-overview/wallet-overview"
import { WalletCurrency } from "@app/graphql/generated"
import { CARD } from "@app/types/amounts"
import { ContextForScreen } from "../../screens/helper"

import type { AccountBalance } from "@app/graphql/wallets-utils"

const mockNavigate = jest.fn()
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate }),
}))

jest.mock("@app/hooks/use-display-currency", () => ({
  useDisplayCurrency: () => ({
    formatMoneyAmount: ({ moneyAmount }: { moneyAmount: { amount: number } }) =>
      `${moneyAmount.amount} sat`,
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

const walletsOnly: AccountBalance[] = [
  { id: "btc-1", balance: 0, walletCurrency: WalletCurrency.Btc },
  { id: "usd-1", balance: 0, walletCurrency: WalletCurrency.Usd },
]

const cardAccount: AccountBalance = {
  id: "card-1",
  walletCurrency: CARD,
  balance: 150000,
}

const withCard: AccountBalance[] = [...walletsOnly, cardAccount]

const defaultProps = {
  loading: false,
  setIsStablesatModalVisible: jest.fn(),
  accounts: walletsOnly,
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

  it("does not render card row when card is not in accounts", () => {
    const { queryByText } = render(
      <ContextForScreen>
        <WalletOverview {...defaultProps} />
      </ContextForScreen>,
    )

    expect(queryByText("150000 sat")).toBeNull()
  })

  it("renders card row when card is in accounts", () => {
    const { getByText } = render(
      <ContextForScreen>
        <WalletOverview {...defaultProps} accounts={withCard} />
      </ContextForScreen>,
    )

    expect(getByText("150000 sat")).toBeTruthy()
  })

  it("navigates to cardDashboardScreen when card row is pressed", () => {
    const { getByText } = render(
      <ContextForScreen>
        <WalletOverview {...defaultProps} accounts={withCard} />
      </ContextForScreen>,
    )

    fireEvent.press(getByText("150000 sat"))

    expect(mockNavigate).toHaveBeenCalledWith("cardDashboardScreen")
  })

  it("shows hidden amount placeholder on card row when hideAmount is enabled", () => {
    mockUseHideAmount.mockReturnValue({
      hideAmount: true,
      switchMemoryHideAmount: jest.fn(),
    })

    const { getAllByText, queryByText } = render(
      <ContextForScreen>
        <WalletOverview {...defaultProps} accounts={withCard} />
      </ContextForScreen>,
    )

    expect(getAllByText("****").length).toBeGreaterThan(0)
    expect(queryByText("150000 sat")).toBeNull()
  })
})
