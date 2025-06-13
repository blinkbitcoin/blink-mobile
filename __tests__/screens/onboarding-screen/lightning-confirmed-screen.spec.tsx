import React from "react"
import { render, fireEvent } from "@testing-library/react-native"
import { useNavigation } from "@react-navigation/native"

import { LightningConfirmedScreen } from "@app/screens/onboarding-screen"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { i18nObject } from "@app/i18n/i18n-util"

import { ContextForScreen } from "../helper"

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: jest.fn(),
}))

describe("LightningConfirmedScreen", () => {
  let LL: ReturnType<typeof i18nObject>

  beforeEach(() => {
    loadLocale("en")
    LL = i18nObject("en")
  })

  it("renders title and descriptions", () => {
    const { getByText } = render(
      <ContextForScreen>
        <LightningConfirmedScreen />
      </ContextForScreen>,
    )

    expect(getByText(LL.OnboardingScreen.lightningConfirmed.title())).toBeTruthy()
    expect(
      getByText(`- ${LL.OnboardingScreen.lightningBenefits.staticAddressDescription()}`),
    ).toBeTruthy()
    expect(
      getByText(`- ${LL.OnboardingScreen.lightningBenefits.easyToShareDescription()}`),
    ).toBeTruthy()
    expect(
      getByText(`- ${LL.OnboardingScreen.lightningBenefits.blinkToolsDescription()}`),
    ).toBeTruthy()
  })

  it("renders icon with expected testID", () => {
    const { getByTestId } = render(
      <ContextForScreen>
        <LightningConfirmedScreen />
      </ContextForScreen>,
    )

    expect(getByTestId("icon-lightning-address-set")).toBeTruthy()
  })

  it("renders primary button with correct label", () => {
    const { getByText } = render(
      <ContextForScreen>
        <LightningConfirmedScreen />
      </ContextForScreen>,
    )

    expect(getByText(LL.common.next())).toBeTruthy()
  })

  it("triggers navigation to supportScreen when pressing the primary button", () => {
    const mockNavigate = jest.fn()
    ;(useNavigation as jest.Mock).mockReturnValue({ navigate: mockNavigate })

    const { getByText } = render(
      <ContextForScreen>
        <LightningConfirmedScreen />
      </ContextForScreen>,
    )

    fireEvent.press(getByText(LL.common.next()))
    expect(mockNavigate).toHaveBeenCalledWith("onboarding", { screen: "supportScreen" })
  })

  it("does not crash if rendered without navigation mocks", () => {
    ;(useNavigation as jest.Mock).mockReturnValue({ navigate: jest.fn() })

    const { getByText } = render(
      <ContextForScreen>
        <LightningConfirmedScreen />
      </ContextForScreen>,
    )

    expect(getByText(LL.OnboardingScreen.lightningConfirmed.title())).toBeTruthy()
  })
})
