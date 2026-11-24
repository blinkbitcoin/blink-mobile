import React from "react"
import { render, fireEvent } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import InAppBrowser from "react-native-inappbrowser-reborn"

import { CardFeeScheduleScreen } from "@app/screens/card-screen/card-fee-schedule-screen"
import { ContextForScreen } from "../helper"
import { flushEffects } from "../../helpers/flush-effects"

jest.mock("react-native-inappbrowser-reborn", () => ({
  open: jest.fn(),
}))

const mockGoBack = jest.fn()
jest.mock("@react-navigation/native", () => {
  const actualNav = jest.requireActual("@react-navigation/native")
  return {
    ...actualNav,
    useNavigation: () => ({
      goBack: mockGoBack,
    }),
  }
})

jest.mock("@app/config/feature-flags-context", () => ({
  useRemoteConfig: () => ({
    cardSubscriptionPriceUsd: 1000,
    cardReplacementFeeUsd: 10,
    cardUsdTransactionFeePercent: 1.21,
    cardForeignTransactionFeePercent: 2.21,
    cardMaxOverdraftUsd: 200,
    cardLateRepaymentFeeUsd: 25,
    cardCardholderAgreementUrl: "https://example.com/cardholder",
  }),
}))

jest.mock("@app/hooks/use-display-currency", () => ({
  useDisplayCurrency: () => ({
    formatCurrency: ({ amountInMajorUnits }: { amountInMajorUnits: number }) =>
      `$${amountInMajorUnits}`,
    formatMoneyAmount: ({
      moneyAmount,
      noFractionDigits,
    }: {
      moneyAmount: { amount: number }
      noFractionDigits?: boolean
    }) => `$${(moneyAmount.amount / 100).toFixed(noFractionDigits ? 0 : 2)}`,
  }),
}))

describe("CardFeeScheduleScreen", () => {
  beforeEach(() => {
    loadLocale("en")
    jest.clearAllMocks()
  })

  it("renders without crashing", async () => {
    const { toJSON } = render(
      <ContextForScreen>
        <CardFeeScheduleScreen />
      </ContextForScreen>,
    )

    await flushEffects()

    expect(toJSON()).toBeTruthy()
  })

  it("displays the three fee sections", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <CardFeeScheduleScreen />
      </ContextForScreen>,
    )

    await flushEffects()

    expect(getByText("Card fees")).toBeTruthy()
    expect(getByText("Transaction fees")).toBeTruthy()
    expect(getByText("Overdraft (funded mode)")).toBeTruthy()
  })

  /** The membership price in the mock is 1000: the card itself has no annual fee, and
   *  the membership is not part of this schedule. */
  it("says the card has no annual fee, whatever the membership costs", async () => {
    const { getByText, queryByText } = render(
      <ContextForScreen>
        <CardFeeScheduleScreen />
      </ContextForScreen>,
    )

    await flushEffects()

    expect(getByText("Annual fee")).toBeTruthy()
    expect(getByText("The Blink Card has no annual fee")).toBeTruthy()
    expect(getByText("$0")).toBeTruthy()
    expect(queryByText(/\/ year/)).toBeNull()
    expect(queryByText(/Waived for the first year/)).toBeNull()
  })

  it("renders every fee amount", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <CardFeeScheduleScreen />
      </ContextForScreen>,
    )

    await flushEffects()

    expect(getByText("$10")).toBeTruthy()
    expect(getByText("1.21%")).toBeTruthy()
    expect(getByText("2.21%")).toBeTruthy()
    expect(getByText("$200")).toBeTruthy()
    expect(getByText("$25")).toBeTruthy()
  })

  it("displays the BTC conversion and cardholder agreement notices", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <CardFeeScheduleScreen />
      </ContextForScreen>,
    )

    await flushEffects()

    expect(getByText("BTC Conversion")).toBeTruthy()
    expect(getByText("Cardholder Agreement")).toBeTruthy()
  })

  it("opens the cardholder agreement when the notice link is pressed", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <CardFeeScheduleScreen />
      </ContextForScreen>,
    )

    await flushEffects()

    fireEvent.press(getByText("Cardholder Agreement"))
    await flushEffects()

    expect(InAppBrowser.open).toHaveBeenCalledWith("https://example.com/cardholder")
  })

  it("shows the additional fee details expanded by default", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <CardFeeScheduleScreen />
      </ContextForScreen>,
    )

    await flushEffects()

    expect(getByText("Foreign currency")).toBeTruthy()
    expect(getByText("No hidden fees")).toBeTruthy()
  })

  it("collapses the additional fee details when the header is pressed", async () => {
    const { getByText, queryByText } = render(
      <ContextForScreen>
        <CardFeeScheduleScreen />
      </ContextForScreen>,
    )

    await flushEffects()

    expect(getByText("No hidden fees")).toBeTruthy()

    fireEvent.press(getByText("Additional fee details"))

    expect(queryByText("No hidden fees")).toBeNull()
  })

  it("navigates back when the Back button is pressed", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <CardFeeScheduleScreen />
      </ContextForScreen>,
    )

    await flushEffects()

    fireEvent.press(getByText("Back"))

    expect(mockGoBack).toHaveBeenCalledTimes(1)
  })
})
