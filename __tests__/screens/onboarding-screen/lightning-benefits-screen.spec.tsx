import React from "react"
import { render, fireEvent } from "@testing-library/react-native"
import { RouteProp, useNavigation } from "@react-navigation/native"

import { LightningBenefitsScreen } from "@app/screens/onboarding-screen"
import { OnboardingStackParamList } from "@app/navigation/stack-param-lists"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { i18nObject } from "@app/i18n/i18n-util"

import { ContextForScreen } from "../helper"

const route: RouteProp<OnboardingStackParamList, "lightningBenefits"> = {
  key: "test-key",
  name: "lightningBenefits",
  params: { onboarding: true },
}

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: jest.fn(),
}))

describe("LightningBenefitsScreen", () => {
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
        <LightningBenefitsScreen route={route} />
      </ContextForScreen>,
    )

    expect(getByText(LL.OnboardingScreen.lightningBenefits.title())).toBeTruthy()
    expect(
      getByText(LL.OnboardingScreen.lightningBenefits.staticAddressDescription()),
    ).toBeTruthy()
    expect(
      getByText(LL.OnboardingScreen.lightningBenefits.easyToShareDescription()),
    ).toBeTruthy()
    expect(
      getByText(LL.OnboardingScreen.lightningBenefits.blinkToolsDescription()),
    ).toBeTruthy()
  })

  it("renders icon with testID", () => {
    const { getByTestId } = render(
      <ContextForScreen>
        <LightningBenefitsScreen route={route} />
      </ContextForScreen>,
    )

    expect(getByTestId("icon-lightning-address")).toBeTruthy()
  })

  it("navigates to setLightningAddress on primary button press", () => {
    const mockNavigate = jest.fn()
    ;(useNavigation as jest.Mock).mockReturnValue({
      navigate: mockNavigate,
      addListener: mockAddListener,
    })

    const { getByText } = render(
      <ContextForScreen>
        <LightningBenefitsScreen route={route} />
      </ContextForScreen>,
    )

    fireEvent.press(getByText(LL.OnboardingScreen.lightningBenefits.primaryButton()))
    expect(mockNavigate).toHaveBeenCalledWith("setLightningAddress", { onboarding: true })
  })

  it("navigates to supportScreen on secondary button press", () => {
    const mockNavigate = jest.fn()
    ;(useNavigation as jest.Mock).mockReturnValue({
      navigate: mockNavigate,
      addListener: mockAddListener,
    })

    const { getByText } = render(
      <ContextForScreen>
        <LightningBenefitsScreen route={route} />
      </ContextForScreen>,
    )

    fireEvent.press(getByText(LL.UpgradeAccountModal.notNow()))
    expect(mockNavigate).toHaveBeenCalledWith("onboarding", { screen: "supportScreen" })
  })

  it("renders both action buttons", () => {
    const { getByText } = render(
      <ContextForScreen>
        <LightningBenefitsScreen route={route} />
      </ContextForScreen>,
    )

    expect(getByText(LL.OnboardingScreen.lightningBenefits.primaryButton())).toBeTruthy()
    expect(getByText(LL.UpgradeAccountModal.notNow())).toBeTruthy()
  })
})
