import React from "react"
import { render, fireEvent, act } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { CardDetailsScreen } from "@app/screens/card-screen/onboarding/card-flow/card-details-screen"
import { ContextForScreen } from "../../../helper"

jest.mock("@react-native-community/blur", () => ({
  BlurView: "BlurView",
}))

jest.mock("react-native-linear-gradient", () => ({
  LinearGradient: "LinearGradient",
}))

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

describe("CardDetailsScreen", () => {
  beforeEach(() => {
    loadLocale("en")
    jest.clearAllMocks()
  })

  it("renders without crashing", async () => {
    const { toJSON } = render(
      <ContextForScreen>
        <CardDetailsScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(toJSON()).toBeTruthy()
  })

  it("displays account manager feature title", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <CardDetailsScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(getByText("Dedicated account manager")).toBeTruthy()
  })

  it("displays support feature title", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <CardDetailsScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(getByText("Priority support")).toBeTruthy()
  })

  it("displays onchain deposits feature title", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <CardDetailsScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(getByText("50% back on transaction fees")).toBeTruthy()
  })

  it("displays circular economies feature title", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <CardDetailsScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(getByText("$100 to circular economies")).toBeTruthy()
  })

  it("displays and more text", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <CardDetailsScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(getByText("... and more coming in 2026")).toBeTruthy()
  })

  it("displays continue button", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <CardDetailsScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(getByText("Continue")).toBeTruthy()
  })

  it("navigates to cardOnboardingSubscribeScreen on button press", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <CardDetailsScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    const button = getByText("Continue")
    await act(async () => {
      fireEvent.press(button)
    })

    expect(mockNavigate).toHaveBeenCalledWith("cardOnboardingSubscribeScreen")
  })
})
