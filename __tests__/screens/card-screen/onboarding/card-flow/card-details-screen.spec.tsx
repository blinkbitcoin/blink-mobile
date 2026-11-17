import React from "react"
import { render, fireEvent, act } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { CardDetailsScreen } from "@app/screens/card-screen/onboarding/card-flow/card-details-screen"
import { ContextForScreen } from "../../../helper"

const mockNavigate = jest.fn()

jest.mock("@react-navigation/native", () => {
  const actualNav = jest.requireActual("@react-navigation/native")
  return {
    ...actualNav,
    useNavigation: () => ({
      navigate: mockNavigate,
    }),
  }
})

const renderScreen = async () => {
  const screen = render(
    <ContextForScreen>
      <CardDetailsScreen />
    </ContextForScreen>,
  )
  await act(async () => {})
  return screen
}

describe("CardDetailsScreen", () => {
  beforeEach(() => {
    loadLocale("en")
    jest.clearAllMocks()
  })

  it("lists what the card comes with today, each with its detail", async () => {
    const { getByText } = await renderScreen()

    expect(getByText("Blink Card")).toBeTruthy()
    expect(getByText("your Visa card, ready today")).toBeTruthy()
    expect(getByText("Personal account manager")).toBeTruthy()
    expect(getByText("and priority support")).toBeTruthy()
  })

  it("marks on/off ramping as coming later, with when it arrives", async () => {
    const { getByText, getAllByText } = await renderScreen()

    expect(getByText("On/Off ramping")).toBeTruthy()
    expect(getAllByText("in 12 months")).toHaveLength(1)
  })

  it("draws each service with the design's icon", async () => {
    const { getByTestId } = await renderScreen()

    expect(getByTestId("icon-card")).toBeTruthy()
    expect(getByTestId("icon-headset")).toBeTruthy()
    expect(getByTestId("icon-wallet")).toBeTruthy()
  })

  /** Business and virtual accounts are Builder services and up, not Blink Orange's. */
  it("lists none of the higher tiers' accounts", async () => {
    const { queryByText } = await renderScreen()

    expect(queryByText("Business accounts")).toBeNull()
    expect(queryByText("Virtual accounts")).toBeNull()
  })

  it("explains the wait with the same number of months as the badges", async () => {
    const { getByText } = await renderScreen()

    expect(
      getByText(
        "Some features will be available within 12 months. The card is ready today.",
      ),
    ).toBeTruthy()
  })

  it("displays continue button", async () => {
    const { getByText } = await renderScreen()

    expect(getByText("Continue")).toBeTruthy()
  })

  it("navigates to cardOnboardingSubscribeScreen on button press", async () => {
    const { getByText } = await renderScreen()

    await act(async () => {
      fireEvent.press(getByText("Continue"))
    })

    expect(mockNavigate).toHaveBeenCalledWith("cardOnboardingSubscribeScreen")
  })
})
