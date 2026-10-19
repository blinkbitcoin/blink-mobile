import React from "react"
import { fireEvent, render, screen } from "@testing-library/react-native"
import { Text } from "react-native"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { GaloySecondaryButton } from "@app/components/atomic/galoy-secondary-button"
import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { TwoFactorSetupContent } from "@app/screens/two-factor-enforcement/setup-content"
import { StepLayout } from "@app/components/step-layout"
import { TwoFactorMethod, TwoFactorTier } from "@app/types/two-factor-enforcement"

import { ContextForScreen } from "../helper"
import { flushEffects } from "../../helpers/flush-effects"

loadLocale("en")
const LL = i18nObject("en")

const mockNavigate = jest.fn()
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate }),
}))

const mockLogTwoFactorSetupStarted = jest.fn()
jest.mock("@app/utils/analytics", () => ({
  logTwoFactorSetupStarted: (...args: unknown[]) => mockLogTwoFactorSetupStarted(...args),
}))

type LayoutOptions = {
  headerShown?: boolean
  header?: React.ReactNode
}

const renderContent = async ({ headerShown, header }: LayoutOptions = {}) => {
  const rendered = render(
    <ContextForScreen>
      <TwoFactorSetupContent
        promptTier={TwoFactorTier.Recommended}
        returnTo="twoFactorSetup"
        headerShown={headerShown}
        header={header}
      />
    </ContextForScreen>,
  )
  await flushEffects()
  return rendered
}

// eslint-disable-next-line camelcase
const primaryButton = () => screen.UNSAFE_getByType(GaloyPrimaryButton)
// eslint-disable-next-line camelcase
const secondaryButton = () => screen.UNSAFE_getByType(GaloySecondaryButton)

describe("TwoFactorSetupContent", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    loadLocale("en")
  })

  it("draws the row it is handed in place of the navigation header", async () => {
    await renderContent({ headerShown: false, header: <Text>header row</Text> })

    expect(screen.getByText("header row")).toBeTruthy()
  })

  it("renders the lock hero with the setup copy", async () => {
    await renderContent()

    expect(screen.getByTestId("icon-lock-closed")).toBeTruthy()
    expect(screen.getByText(LL.TwoFactorEnforcement.setupTitle())).toBeTruthy()
    expect(screen.getByText(LL.TwoFactorEnforcement.setupDescription())).toBeTruthy()
  })

  /** An email or a phone added to the one the account logs in with protects nothing:
   *  the setup offers the authenticator, or leaving custody, and nothing else. */
  it("offers the authenticator first and leaving custody second, with no email or phone", async () => {
    await renderContent()

    expect(primaryButton().props.title).toBe(LL.TwoFactorEnforcement.setAuthenticator())
    expect(secondaryButton().props.title).toBe(LL.AccountMigration.moveToNonCustodial())
    expect(screen.queryByText("Add email")).toBeNull()
    expect(screen.queryByText("Add phone number")).toBeNull()
  })

  it("opens the authenticator setup, told to return here, under the tier it was raised for", async () => {
    await renderContent()

    fireEvent.press(screen.getByText(LL.TwoFactorEnforcement.setAuthenticator()))

    expect(mockNavigate).toHaveBeenCalledWith("totpRegistrationInitiate", {
      returnTo: "twoFactorSetup",
    })
    expect(mockLogTwoFactorSetupStarted).toHaveBeenCalledWith({
      tier: TwoFactorTier.Recommended,
      method: TwoFactorMethod.Authenticator,
    })
  })

  /** Leaving custody goes through the screen that explains what it means; that screen
   *  reports the choice, so nothing is reported here. */
  it("opens the screen that explains leaving custody, reporting nothing itself", async () => {
    await renderContent()

    fireEvent.press(screen.getByText(LL.AccountMigration.moveToNonCustodial()))

    expect(mockNavigate).toHaveBeenCalledWith("twoFactorNonCustodial")
    expect(mockLogTwoFactorSetupStarted).not.toHaveBeenCalled()
  })

  it("draws the navigation header unless told otherwise", async () => {
    await renderContent()
    // eslint-disable-next-line camelcase
    expect(screen.UNSAFE_getByType(StepLayout).props.headerShown).toBeUndefined()

    screen.unmount()
    await renderContent({ headerShown: false })

    // eslint-disable-next-line camelcase
    expect(screen.UNSAFE_getByType(StepLayout).props.headerShown).toBe(false)
  })
})
