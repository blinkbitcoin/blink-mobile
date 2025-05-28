import React from "react"
import { useNavigation, RouteProp } from "@react-navigation/native"
import { render, fireEvent } from "@testing-library/react-native"

import { loadLocale } from "@app/i18n/i18n-util.sync"
import { i18nObject } from "@app/i18n/i18n-util"
import { WelcomeLevel1Screen } from "@app/screens/onboarding-screen"
import { OnboardingStackParamList } from "@app/navigation/stack-param-lists"

import { ContextForScreen } from "../helper"

const route: RouteProp<OnboardingStackParamList, "welcomeLevel1"> = {
  key: "test-key",
  name: "welcomeLevel1",
  params: {
    onboarding: true,
  },
}

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: jest.fn(),
}))

describe("WelcomeLevel1Screen", () => {
  let LL: ReturnType<typeof i18nObject>

  beforeEach(() => {
    loadLocale("en")
    LL = i18nObject("en")
  })

  it("Renders localized title and description lines", () => {
    const { getByText } = render(
      <ContextForScreen>
        <WelcomeLevel1Screen route={route} />
      </ContextForScreen>,
    )

    expect(getByText(LL.OnboardingScreen.welcomeLevel1.title())).toBeTruthy()
    expect(
      getByText(`- ${LL.OnboardingScreen.welcomeLevel1.receibeBitcoinDescription()}`),
    ).toBeTruthy()
    expect(
      getByText(`- ${LL.OnboardingScreen.welcomeLevel1.dailyLimitDescription()}`),
    ).toBeTruthy()
    expect(
      getByText(`- ${LL.OnboardingScreen.welcomeLevel1.onchainDescription()}`),
    ).toBeTruthy()
  })

  it("Triggers primary action button with label", () => {
    const mockReplace = jest.fn()
    ;(useNavigation as jest.Mock).mockReturnValue({ replace: mockReplace })

    const { getByText } = render(
      <ContextForScreen>
        <WelcomeLevel1Screen route={route} />
      </ContextForScreen>,
    )

    const primaryBtn = getByText(LL.common.next())
    fireEvent.press(primaryBtn)
    expect(mockReplace).toHaveBeenCalledWith("onboarding", {
      screen: "emailBenefits",
      params: {
        onboarding: true,
      },
    })
  })
})
