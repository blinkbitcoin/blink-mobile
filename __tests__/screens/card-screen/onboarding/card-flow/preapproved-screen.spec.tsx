import React from "react"
import { render, fireEvent, act } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { CardPreapprovedScreen } from "@app/screens/card-screen/onboarding/card-flow/preapproved-screen"
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

describe("CardPreapprovedScreen", () => {
  beforeEach(() => {
    loadLocale("en")
    jest.clearAllMocks()
  })

  it("renders without crashing", async () => {
    const { toJSON } = render(
      <ContextForScreen>
        <CardPreapprovedScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(toJSON()).toBeTruthy()
  })

  it("displays preapproved title", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <CardPreapprovedScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(getByText("You have been pre-approved for the Blink Visa card!")).toBeTruthy()
  })

  it("displays continue button", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <CardPreapprovedScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(getByText("Close")).toBeTruthy()
  })

  it("navigates to Primary on button press", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <CardPreapprovedScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    const button = getByText("Close")
    await act(async () => {
      fireEvent.press(button)
    })

    expect(mockNavigate).toHaveBeenCalledWith("Primary")
  })
})
