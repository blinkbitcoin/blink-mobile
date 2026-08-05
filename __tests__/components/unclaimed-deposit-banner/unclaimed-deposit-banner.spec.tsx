import React from "react"
import { fireEvent, render } from "@testing-library/react-native"
import { ThemeProvider } from "@rn-vui/themed"

import theme from "@app/rne-theme/theme"
import { UnclaimedDepositBanner } from "@app/components/unclaimed-deposit-banner/unclaimed-deposit-banner"
import { DepositStatus, type PendingDeposit } from "@app/types/payment"
import { WalletCurrency } from "@app/graphql/generated"

const mockNavigate = jest.fn()

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      UnclaimedDeposit: {
        title: ({ count }: { count: number }) => `${count} pending`,
        description: ({ sats }: { sats: number }) => `${sats} sats`,
      },
    },
  }),
}))

const buildDeposit = (overrides: Partial<PendingDeposit> = {}): PendingDeposit => ({
  id: "deposit-1",
  txid: "tx",
  vout: 0,
  amount: { amount: 1000, currency: WalletCurrency.Btc, currencyCode: "BTC" },
  status: DepositStatus.Claimable,
  errorReason: null,
  ...overrides,
})

const renderBanner = (deposits: PendingDeposit[] = []) =>
  render(
    <ThemeProvider theme={theme}>
      <UnclaimedDepositBanner deposits={deposits} />
    </ThemeProvider>,
  )

describe("UnclaimedDepositBanner", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("renders nothing when there are no pending deposits", () => {
    const { queryByTestId } = renderBanner()

    expect(queryByTestId("unclaimed-deposit-banner")).toBeNull()
  })

  it("renders count and total sats when deposits are pending", () => {
    const { getByText } = renderBanner([
      buildDeposit({
        id: "1",
        amount: { amount: 1000, currency: WalletCurrency.Btc, currencyCode: "BTC" },
      }),
      buildDeposit({
        id: "2",
        amount: { amount: 2500, currency: WalletCurrency.Btc, currencyCode: "BTC" },
      }),
    ])

    expect(getByText("2 pending")).toBeTruthy()
    expect(getByText("3500 sats")).toBeTruthy()
  })

  it("filters out refunded deposits from the count and total", () => {
    const { getByText } = renderBanner([
      buildDeposit({ id: "1", status: DepositStatus.Claimable }),
      buildDeposit({
        id: "2",
        status: DepositStatus.Refunded,
        amount: { amount: 9999, currency: WalletCurrency.Btc, currencyCode: "BTC" },
      }),
    ])

    expect(getByText("1 pending")).toBeTruthy()
    expect(getByText("1000 sats")).toBeTruthy()
  })

  it("renders nothing when every deposit is refunded", () => {
    const { queryByTestId } = renderBanner([
      buildDeposit({ id: "1", status: DepositStatus.Refunded }),
    ])

    expect(queryByTestId("unclaimed-deposit-banner")).toBeNull()
  })

  it("navigates to the unclaimed-deposits screen on press", () => {
    const { getByTestId } = renderBanner([buildDeposit()])

    fireEvent.press(getByTestId("unclaimed-deposit-banner"))

    expect(mockNavigate).toHaveBeenCalledWith("unclaimedDepositsScreen")
  })
})
