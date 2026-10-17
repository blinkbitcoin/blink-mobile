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

const mockEnforcement = {
  missingMethod: TwoFactorMethod.Email as TwoFactorMethod,
  unverifiedEmail: null as string | null,
}
jest.mock("@app/custodial/providers/two-factor-enforcement", () => ({
  useTwoFactorEnforcement: () => mockEnforcement,
}))

const mockLogTwoFactorSetupStarted = jest.fn()
jest.mock("@app/utils/analytics", () => ({
  logTwoFactorSetupStarted: (...args: unknown[]) => mockLogTwoFactorSetupStarted(...args),
}))

const mockPromptReverification = jest.fn()

type LayoutOptions = {
  isReverifying?: boolean
  headerShown?: boolean
  header?: React.ReactNode
}

const renderContent = async ({
  isReverifying = false,
  headerShown,
  header,
}: LayoutOptions = {}) => {
  const rendered = render(
    <ContextForScreen>
      <TwoFactorSetupContent
        promptTier={TwoFactorTier.Required}
        returnTo="twoFactorSetup"
        promptReverification={mockPromptReverification}
        isReverifying={isReverifying}
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
    mockEnforcement.missingMethod = TwoFactorMethod.Email
    mockEnforcement.unverifiedEmail = null
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

  it("makes the authenticator the primary button and the missing email the secondary one", async () => {
    await renderContent()

    expect(primaryButton().props.title).toBe(LL.TwoFactorEnforcement.setAuthenticator())
    expect(secondaryButton().props.title).toBe(LL.TwoFactorEnforcement.addEmail())
  })

  it("keeps the authenticator primary when the phone number is the missing factor", async () => {
    mockEnforcement.missingMethod = TwoFactorMethod.Phone
    await renderContent()

    expect(primaryButton().props.title).toBe(LL.TwoFactorEnforcement.setAuthenticator())
    expect(secondaryButton().props.title).toBe(LL.TwoFactorEnforcement.addPhoneNumber())
  })

  it("opens the authenticator setup, told to return here, under the tier it was raised for", async () => {
    await renderContent()

    fireEvent.press(screen.getByText(LL.TwoFactorEnforcement.setAuthenticator()))

    expect(mockNavigate).toHaveBeenCalledWith("totpRegistrationInitiate", {
      returnTo: "twoFactorSetup",
    })
    expect(mockLogTwoFactorSetupStarted).toHaveBeenCalledWith({
      tier: TwoFactorTier.Required,
      method: TwoFactorMethod.Authenticator,
    })
  })

  it("adds an email when that is the missing factor, told to return here", async () => {
    await renderContent()

    fireEvent.press(screen.getByText(LL.TwoFactorEnforcement.addEmail()))

    expect(mockNavigate).toHaveBeenCalledWith("emailRegistrationInitiate", {
      returnTo: "twoFactorSetup",
    })
    expect(mockPromptReverification).not.toHaveBeenCalled()
    expect(mockLogTwoFactorSetupStarted).toHaveBeenCalledWith({
      tier: TwoFactorTier.Required,
      method: TwoFactorMethod.Email,
    })
  })

  it("sends an address that was never verified through re-verification", async () => {
    mockEnforcement.unverifiedEmail = "someone@example.com"
    await renderContent()

    fireEvent.press(screen.getByText(LL.TwoFactorEnforcement.addEmail()))

    expect(mockPromptReverification).toHaveBeenCalledWith("someone@example.com")
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it("adds a phone number when the email is already verified", async () => {
    mockEnforcement.missingMethod = TwoFactorMethod.Phone
    await renderContent()

    expect(screen.queryByText(LL.TwoFactorEnforcement.addEmail())).toBeNull()
    fireEvent.press(screen.getByText(LL.TwoFactorEnforcement.addPhoneNumber()))

    expect(mockNavigate).toHaveBeenCalledWith("phoneRegistrationInitiate")
    expect(mockLogTwoFactorSetupStarted).toHaveBeenCalledWith({
      tier: TwoFactorTier.Required,
      method: TwoFactorMethod.Phone,
    })
  })

  it("holds both buttons while a re-verification is in flight", async () => {
    mockEnforcement.unverifiedEmail = "someone@example.com"
    await renderContent({ isReverifying: true })

    /** The missing-factor button shows its spinner in place of its title while it is
     *  held, so there is no label to press; its disabled state is what keeps a second
     *  re-verification from starting. */
    expect(secondaryButton().props.loading).toBe(true)
    expect(secondaryButton().props.disabled).toBe(true)
    fireEvent.press(screen.getByText(LL.TwoFactorEnforcement.setAuthenticator()))

    expect(mockNavigate).not.toHaveBeenCalled()
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
