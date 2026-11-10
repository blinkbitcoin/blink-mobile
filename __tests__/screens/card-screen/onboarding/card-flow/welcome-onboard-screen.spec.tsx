import React from "react"
import { render, fireEvent, act } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { WelcomeOnboardScreen } from "@app/screens/card-screen/onboarding/card-flow/welcome-onboard-screen"
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

describe("WelcomeOnboardScreen", () => {
  beforeEach(() => {
    loadLocale("en")
    jest.clearAllMocks()
  })

  it("renders without crashing", async () => {
    const { toJSON } = render(
      <ContextForScreen>
        <WelcomeOnboardScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(toJSON()).toBeTruthy()
  })

  it("displays welcome title", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <WelcomeOnboardScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(getByText("Welcome onboard")).toBeTruthy()
  })

  it("displays subtitle", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <WelcomeOnboardScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(getByText(/To Blink Orange/)).toBeTruthy()
  })

  it("displays body1 paragraph", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <WelcomeOnboardScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(
      getByText(
        "Someone thought of you and suggested that we should invite you to Blink Orange. Probably because you are an awesome Bitcoiner.",
      ),
    ).toBeTruthy()
  })

  it("displays body2 paragraph", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <WelcomeOnboardScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(
      getByText(
        "Blink Orange is the first tier of Blink's membership for Bitcoiners, by invitation. The Blink Card and your personal account manager are two of the first services we offer — the rest we're building through 2027.",
      ),
    ).toBeTruthy()
  })

  it("displays let's go button", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <WelcomeOnboardScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(getByText("Let's go")).toBeTruthy()
  })

  it("navigates to cardOnboardingIntroducingScreen on button press", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <WelcomeOnboardScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    const button = getByText("Let's go")
    await act(async () => {
      fireEvent.press(button)
    })

    expect(mockNavigate).toHaveBeenCalledWith("cardOnboardingIntroducingScreen")
  })
})
