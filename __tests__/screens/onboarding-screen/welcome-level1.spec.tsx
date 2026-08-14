import React from "react"
import { useNavigation, RouteProp } from "@react-navigation/native"
import { render, fireEvent } from "@testing-library/react-native"

import { loadLocale } from "@app/i18n/i18n-util.sync"
import { LEVEL_ONE_DAILY_LIMIT_USD } from "@app/config"
import { i18nObject } from "@app/i18n/i18n-util"
import { useSettingsScreenQuery } from "@app/graphql/generated"
import { WelcomeLevel1Screen } from "@app/screens/onboarding-screen"
import { OnboardingStackParamList } from "@app/navigation/stack-param-lists"

import { ContextForScreen } from "../helper"
import { flushEffects } from "../../helpers/flush-effects"

const route: RouteProp<OnboardingStackParamList, "welcomeLevel1"> = {
  key: "test-key",
  name: "welcomeLevel1",
  params: {
    onboarding: true,
  },
}

const usernameMock = {
  loading: false,
  data: {
    me: {
      username: "userexample",
    },
  },
}

jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useSettingsScreenQuery: jest.fn(),
}))

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: jest.fn(),
}))

describe("WelcomeLevel1Screen", () => {
  let LL: ReturnType<typeof i18nObject>
  const mockAddListener = jest.fn(() => jest.fn())

  beforeEach(() => {
    ;(useSettingsScreenQuery as jest.Mock).mockReturnValue(usernameMock)
    ;(useNavigation as jest.Mock).mockReturnValue({
      addListener: mockAddListener,
    })
    mockAddListener.mockClear()

    loadLocale("en")
    LL = i18nObject("en")
  })

  it("Renders localized title and description lines", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <WelcomeLevel1Screen route={route} />
      </ContextForScreen>,
    )
    await flushEffects()

    expect(getByText(LL.OnboardingScreen.welcomeLevel1.title())).toBeTruthy()
    expect(
      getByText(LL.OnboardingScreen.welcomeLevel1.receiveBitcoinDescription()),
    ).toBeTruthy()
    expect(
      getByText(
        LL.OnboardingScreen.welcomeLevel1.dailyLimitDescription({
          amount: LEVEL_ONE_DAILY_LIMIT_USD,
        }),
      ),
    ).toBeTruthy()
    expect(getByText(LL.OnboardingScreen.welcomeLevel1.onchainDescription())).toBeTruthy()
  })

  /**
   * SSF audit finding (blink-wip#739): the enforced level 1 limit is USD 999/day, so
   * the advertised copy must not say 1,000. Pinned as a literal on purpose, since the
   * point is to fail when the amount in the copy changes.
   */
  it("Advertises the audited USD 999 daily limit", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <WelcomeLevel1Screen route={route} />
      </ContextForScreen>,
    )
    await flushEffects()

    expect(getByText("Send up to USD 999 per day", { exact: false })).toBeTruthy()
  })

  it("Triggers primary action button with label", async () => {
    const mockReplace = jest.fn()
    ;(useNavigation as jest.Mock).mockReturnValue({
      replace: mockReplace,
      addListener: mockAddListener,
      navigate: mockReplace,
    })

    const { getByText } = render(
      <ContextForScreen>
        <WelcomeLevel1Screen route={route} />
      </ContextForScreen>,
    )
    await flushEffects()

    const primaryBtn = getByText(LL.common.next())
    fireEvent.press(primaryBtn)
    expect(mockReplace).toHaveBeenCalledWith("onboarding", {
      screen: "emailBenefits",
      params: {
        onboarding: true,
        hasUsername: true,
      },
    })
  })
})
