import React from "react"
import { render, fireEvent } from "@testing-library/react-native"
import { RouteProp, useNavigation } from "@react-navigation/native"

import { loadLocale } from "@app/i18n/i18n-util.sync"
import { i18nObject } from "@app/i18n/i18n-util"
import { SupportOnboardingScreen } from "@app/screens/onboarding-screen"
import { OnboardingStackParamList } from "@app/navigation/stack-param-lists"

import { ContextForScreen } from "../helper"

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: jest.fn(),
}))

jest.mock("react-native/Libraries/Linking/Linking", () => ({
  openURL: jest.fn(),
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  removeEventListener: jest.fn(),
  getInitialURL: jest.fn(),
  canOpenURL: jest.fn(),
}))

const route: RouteProp<OnboardingStackParamList, "supportScreen"> = {
  key: "test-key",
  name: "supportScreen",
  params: {
    canGoBack: true,
  },
}

const FEEDBACK_EMAIL_ADDRESS = "feedback@blink.sv"

describe("SupportOnboardingScreen", () => {
  let LL: ReturnType<typeof i18nObject>
  const mockAddListener = jest.fn(() => jest.fn())

  beforeEach(() => {
    ;(useNavigation as jest.Mock).mockReturnValue({
      addListener: mockAddListener,
    })
    mockAddListener.mockClear()

    loadLocale("en")
    LL = i18nObject("en")
  })

  it("renders title and description", () => {
    const { getByText } = render(
      <ContextForScreen>
        <SupportOnboardingScreen route={route} />
      </ContextForScreen>,
    )

    expect(
      getByText(
        LL.OnboardingScreen.supportScreen.description({ email: FEEDBACK_EMAIL_ADDRESS }),
      ),
    ).toBeTruthy()
    expect(getByText(FEEDBACK_EMAIL_ADDRESS)).toBeTruthy()
  })

  it("renders icon with correct testID", () => {
    const { getByTestId } = render(
      <ContextForScreen>
        <SupportOnboardingScreen route={route} />
      </ContextForScreen>,
    )

    expect(getByTestId("icon-support")).toBeTruthy()
  })

  it("calls navigation.replace when primary action is pressed", () => {
    const mockReplace = jest.fn()
    ;(useNavigation as jest.Mock).mockReturnValue({
      replace: mockReplace,
      addListener: mockAddListener,
      navigate: mockReplace,
    })

    const { getByText } = render(
      <ContextForScreen>
        <SupportOnboardingScreen route={route} />
      </ContextForScreen>,
    )

    fireEvent.press(getByText(LL.OnboardingScreen.supportScreen.primaryButton()))
    expect(mockReplace).toHaveBeenCalledWith("Primary")
  })
})
