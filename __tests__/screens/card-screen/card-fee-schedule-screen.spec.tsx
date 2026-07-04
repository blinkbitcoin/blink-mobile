import React from "react"
import { render, fireEvent } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { CardFeeScheduleScreen } from "@app/screens/card-screen/card-fee-schedule-screen"
import { ContextForScreen } from "../helper"
import { flushEffects } from "../../helpers/flush-effects"

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

  it("renders the annual fee with the injected amount", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <CardFeeScheduleScreen />
      </ContextForScreen>,
    )

    await flushEffects()

    expect(getByText("Annual fee")).toBeTruthy()
    expect(getByText("$1,000 / year")).toBeTruthy()
  })

  it("renders every fee amount", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <CardFeeScheduleScreen />
      </ContextForScreen>,
    )

    await flushEffects()

    expect(getByText("$10.00")).toBeTruthy()
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
