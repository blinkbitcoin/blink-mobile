import React from "react"
import { render, fireEvent, act } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { CardPreapprovedScreen } from "@app/screens/card-screen/onboarding/card-flow/preapproved-screen"
import { ContextForScreen } from "../../../helper"

/** The burst itself is covered by the confetti spec; here only its presence matters. */
jest.mock("@app/components/confetti", () => {
  const { View } = jest.requireActual("react-native")
  return { Confetti: () => <View testID="confetti" /> }
})

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

  it("says the card is ready and that it can be activated now", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <CardPreapprovedScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(getByText("Your Blink Card is ready!")).toBeTruthy()
    expect(getByText("You can now activate your card and start using it")).toBeTruthy()
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

  it("celebrates the approval with confetti", async () => {
    const { getByTestId } = render(
      <ContextForScreen>
        <CardPreapprovedScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(getByTestId("confetti")).toBeTruthy()
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
