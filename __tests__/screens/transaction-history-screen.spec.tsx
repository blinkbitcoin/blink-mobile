import React from "react"
import { act, fireEvent, render, waitFor, cleanup } from "@testing-library/react-native"

import { TransactionHistoryScreen } from "@app/screens/transaction-history"

import { ContextForScreen } from "./helper"

describe("TransactionHistoryScreen", () => {
  afterEach(cleanup)

  it("shows all transactions by default", async () => {
    const { findByTestId } = render(
      <ContextForScreen>
        <TransactionHistoryScreen />
      </ContextForScreen>,
    )

    expect(await findByTestId("transaction-by-index-0")).toBeTruthy()
  })

  it("filters only BTC transactions", async () => {
    const screen = render(
      <ContextForScreen>
        <TransactionHistoryScreen />
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
})
