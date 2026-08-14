import React from "react"
import { fireEvent, render } from "@testing-library/react-native"

import { ThemeProvider } from "@rn-vui/themed"
import TypesafeI18n from "@app/i18n/i18n-react"
import { loadLocale } from "@app/i18n/i18n-util.sync"

const mockNavigate = jest.fn()

jest.mock("react-native-modal", () => require("../../helpers/react-native-modal-mock"))

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate }),
}))

// avoid pulling the firebase app-check native module in via the phone-auth screen
jest.mock("@app/screens/phone-auth-screen", () => ({
  PhoneLoginInitiateType: { Login: "Login", CreateAccount: "CreateAccount" },
}))

import { TrialAccountLimitsModal } from "@app/components/upgrade-account-modal"

loadLocale("en")

const MODAL_TITLE = "Upgrade for more benefits"
// SSF audit finding (blink-wip#739): the enforced level 1 limit is USD 999/day,
// so the advertised copy must not say 1,000.
const DAILY_LIMIT = "USD 999 daily transaction limit"
const UPGRADE_CTA = "Upgrade to Level 1"
const NOT_NOW = "Not now"

const wrap = (ui: React.ReactElement) => (
  <ThemeProvider>
    <TypesafeI18n locale="en">{ui}</TypesafeI18n>
  </ThemeProvider>
)

const renderModal = (
  overrides?: Partial<React.ComponentProps<typeof TrialAccountLimitsModal>>,
) =>
  render(
    wrap(
      <TrialAccountLimitsModal isVisible={true} closeModal={jest.fn()} {...overrides} />,
    ),
  )

describe("TrialAccountLimitsModal", () => {
  beforeEach(() => {
    mockNavigate.mockClear()
  })

  it("renders the level 1 benefit items", () => {
    const { getByText } = renderModal()

    expect(getByText(MODAL_TITLE)).toBeTruthy()
    expect(getByText("Recover funds by SMS or email", { exact: false })).toBeTruthy()
    expect(getByText("Receive bitcoin onchain", { exact: false })).toBeTruthy()
  })

  it("advertises the audited USD 999 daily limit", () => {
    const { getByText } = renderModal()

    expect(getByText(DAILY_LIMIT, { exact: false })).toBeTruthy()
  })

  it("renders nothing when isVisible is false", () => {
    const { queryByText } = renderModal({ isVisible: false })

    expect(queryByText(MODAL_TITLE)).toBeNull()
  })

  it("navigates to account creation and closes from the upgrade action", () => {
    const closeModal = jest.fn()
    const beforeSubmit = jest.fn()
    const { getByText } = renderModal({ closeModal, beforeSubmit })

    fireEvent.press(getByText(UPGRADE_CTA))

    expect(beforeSubmit).toHaveBeenCalledTimes(1)
    expect(mockNavigate).toHaveBeenCalledWith("login", {
      type: "CreateAccount",
      title: UPGRADE_CTA,
      onboarding: true,
    })
    expect(closeModal).toHaveBeenCalledTimes(1)
  })

  it("closes without navigating from the secondary action", () => {
    const closeModal = jest.fn()
    const { getByText } = renderModal({ closeModal })

    fireEvent.press(getByText(NOT_NOW))

    expect(closeModal).toHaveBeenCalledTimes(1)
    expect(mockNavigate).not.toHaveBeenCalled()
  })
})
