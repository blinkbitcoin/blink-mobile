import React from "react"
import { RouteProp } from "@react-navigation/native"
import { act, fireEvent, render, waitFor, cleanup } from "@testing-library/react-native"

import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { TransactionHistoryScreen } from "@app/screens/transaction-history"

import { ContextForScreen } from "./helper"

const mockRouteWithCurrencyFilter = (
  currency?: "BTC" | "USD",
): RouteProp<RootStackParamList, "transactionHistory"> => ({
  key: `transactionHistory-test`,
  name: "transactionHistory",
  params: {
    wallets: [
      {
        id: "e821e124-1c70-4aab-9416-074ee5be21f6",
        walletCurrency: "BTC",
      },
      {
        id: "5b54bf9a-46cc-4344-b638-b5e5e157a892",
        walletCurrency: "USD",
      },
    ],
    ...(currency ? { currencyFilter: currency } : {}),
  },
})

describe("TransactionHistoryScreen", () => {
  afterEach(cleanup)

  it("shows all transactions by default", async () => {
    const { findByTestId } = render(
      <ContextForScreen>
        <TransactionHistoryScreen route={mockRouteWithCurrencyFilter()} />
      </ContextForScreen>,
    )

    expect(await findByTestId("transaction-by-index-0")).toBeTruthy()
  })

  it("filters only BTC transactions", async () => {
    const screen = render(
      <ContextForScreen>
        <TransactionHistoryScreen route={mockRouteWithCurrencyFilter()} />
      </ContextForScreen>,
    )

    await waitFor(() => {
      expect(screen.getByTestId("transaction-by-index-0")).toBeTruthy()
    })

    const dropdown = screen.getByTestId("wallet-filter-dropdown")
    await act(() => fireEvent.press(dropdown))

    const btcOption = await screen.findByText("BTC")

    await act(() => fireEvent.press(btcOption))

    await waitFor(() => {
      expect(screen.queryByText("user_btc")).toBeTruthy()
      expect(screen.queryByText("user_usd")).toBeNull()
    })
  })

  it("filters only BTC by route param", async () => {
    const screen = render(
      <ContextForScreen>
        <TransactionHistoryScreen route={mockRouteWithCurrencyFilter("BTC")} />
      </ContextForScreen>,
    )

    await waitFor(() => {
      expect(screen.getByTestId("transaction-by-index-0")).toBeTruthy()
    })

    expect(screen.queryByText("user_btc")).toBeTruthy()
    expect(screen.queryByText("user_usd")).toBeNull()
  })
})
