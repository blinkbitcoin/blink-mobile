import React from "react"
import { Platform, StyleSheet } from "react-native"
import { render, fireEvent, act } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { CardIntroducingScreen } from "@app/screens/card-screen/onboarding/card-flow/card-introducing-screen"
import { ContextForScreen } from "../../../helper"

jest.mock("@react-native-community/blur", () => ({
  BlurView: "BlurView",
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

const originalPlatformOS = Platform.OS

const renderScreen = async () => {
  const screen = render(
    <ContextForScreen>
      <CardIntroducingScreen />
    </ContextForScreen>,
  )
  await act(async () => {})
  return screen
}

describe("CardIntroducingScreen", () => {
  beforeEach(() => {
    loadLocale("en")
    jest.clearAllMocks()
  })

  afterEach(() => {
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      value: originalPlatformOS,
    })
  })

  it("renders without crashing", async () => {
    const { toJSON } = await renderScreen()

    expect(toJSON()).toBeTruthy()
  })

  it("displays bitcoin card text", async () => {
    const { getByText } = await renderScreen()

    expect(getByText("The Blink Card")).toBeTruthy()
  })

  it("displays 'for' text", async () => {
    const { getByText } = await renderScreen()

    expect(getByText("for")).toBeTruthy()
  })

  it("displays bitcoiners text", async () => {
    const { getByText } = await renderScreen()

    expect(getByText("Bitcoiners")).toBeTruthy()
  })

  it("shows the placeholder card with the number masked and the date visible", async () => {
    const { getByText } = await renderScreen()

    expect(getByText("•••• •••• •••• 2121")).toBeTruthy()
    expect(getByText(/^\d{2}\/ \d{2}$/)).toBeTruthy()
  })

  it("sets 'for' in the italic face, with the italic style iOS needs to keep it", async () => {
    Object.defineProperty(Platform, "OS", { configurable: true, value: "ios" })
    const { getByText } = await renderScreen()

    expect(StyleSheet.flatten(getByText("for").props.style)).toMatchObject({
      fontFamily: "SourceSansPro-Italic",
      fontStyle: "italic",
    })
  })

  /** Android looks for `<face>_italic.ttf` when the style is italic and falls back to
   *  Roboto without it, so there the named face has to carry the italic alone. */
  it("names only the italic face on Android", async () => {
    Object.defineProperty(Platform, "OS", { configurable: true, value: "android" })
    const { getByText } = await renderScreen()

    const style = StyleSheet.flatten(getByText("for").props.style)
    expect(style.fontFamily).toBe("SourceSansPro-Italic")
    expect(style.fontStyle).toBeUndefined()
  })

  it("displays continue button", async () => {
    const { getByText } = await renderScreen()

    expect(getByText("Continue")).toBeTruthy()
  })

  it("navigates to cardOnboardingDetailsScreen on button press", async () => {
    const { getByText } = await renderScreen()

    await act(async () => {
      fireEvent.press(getByText("Continue"))
    })

    expect(mockNavigate).toHaveBeenCalledWith("cardOnboardingDetailsScreen")
  })
})
