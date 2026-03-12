import React from "react"
import { render, fireEvent, act } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { CardIntroducingScreen } from "@app/screens/card-screen/onboarding/card-flow/card-introducing-screen"
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

describe("CardIntroducingScreen", () => {
  beforeEach(() => {
    loadLocale("en")
    jest.clearAllMocks()
  })

  it("renders without crashing", async () => {
    const { toJSON } = render(
      <ContextForScreen>
        <CardIntroducingScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(toJSON()).toBeTruthy()
  })

  it("displays bitcoin card text", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <CardIntroducingScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(getByText("The Blink Visa card")).toBeTruthy()
  })

  it("displays 'for' text", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <CardIntroducingScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(getByText("for")).toBeTruthy()
  })

  it("displays maximalist text", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <CardIntroducingScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(getByText("Bitcoin Maximalists")).toBeTruthy()
  })

  it("displays continue button", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <CardIntroducingScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(getByText("Continue")).toBeTruthy()
  })

  it("navigates to cardOnboardingDetailsScreen on button press", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <CardIntroducingScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    const button = getByText("Continue")
    await act(async () => {
      fireEvent.press(button)
    })

    expect(mockNavigate).toHaveBeenCalledWith("cardOnboardingDetailsScreen")
  })
})
