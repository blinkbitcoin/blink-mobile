import React from "react"
import { render } from "@testing-library/react-native"

import { ThemeProvider } from "@rn-vui/themed"
import TypesafeI18n from "@app/i18n/i18n-react"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { i18nObject } from "@app/i18n/i18n-util"

jest.mock("react-native-modal", () => {
  const ReactNs = jest.requireActual<typeof import("react")>("react")
  const RN = jest.requireActual<typeof import("react-native")>("react-native")
  const MockModal = ({
    children,
    isVisible,
  }: {
    children: React.ReactNode
    isVisible: boolean
  }) => (isVisible ? ReactNs.createElement(RN.View, null, children) : null)
  return { __esModule: true, default: MockModal }
})

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: jest.fn() }),
}))

// avoid pulling the firebase app-check native module in via the phone-auth screen
jest.mock("@app/screens/phone-auth-screen", () => ({
  PhoneLoginInitiateType: { SignIn: "SignIn", CreateAccount: "CreateAccount" },
}))

import { TrialAccountLimitsModal } from "@app/components/upgrade-account-modal"

loadLocale("en")
const LL = i18nObject("en")

const wrap = (ui: React.ReactElement) => (
  <ThemeProvider>
    <TypesafeI18n locale="en">{ui}</TypesafeI18n>
  </ThemeProvider>
)

describe("TrialAccountLimitsModal", () => {
  it("renders the level 1 benefit items", () => {
    const { getByText } = render(
      wrap(<TrialAccountLimitsModal isVisible={true} closeModal={jest.fn()} />),
    )

    expect(getByText(LL.GetStartedScreen.trialAccountLimits.modalTitle())).toBeTruthy()
    expect(
      getByText(LL.GetStartedScreen.trialAccountLimits.recoveryOption(), {
        exact: false,
      }),
    ).toBeTruthy()
    expect(
      getByText(LL.GetStartedScreen.trialAccountLimits.dailyLimit(), { exact: false }),
    ).toBeTruthy()
    expect(
      getByText(LL.GetStartedScreen.trialAccountLimits.onchainReceive(), {
        exact: false,
      }),
    ).toBeTruthy()
  })

  it("shows the audited USD 999 daily limit", () => {
    // SSF audit finding (blink-wip#739): the enforced level 1 limit is $999/day,
    // so the advertised copy must not say 1,000.
    expect(LL.GetStartedScreen.trialAccountLimits.dailyLimit()).toContain("USD 999")
    expect(LL.OnboardingScreen.welcomeLevel1.dailyLimitDescription()).toContain("USD 999")
  })
})
