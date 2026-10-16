import React from "react"
import { act, fireEvent, render, screen } from "@testing-library/react-native"
import { ThemeProvider } from "@rn-vui/themed"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { GaloySecondaryButton } from "@app/components/atomic/galoy-secondary-button"
import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import theme from "@app/rne-theme/theme"
import { TwoFactorSetupScreen } from "@app/screens/two-factor-enforcement"
import { TwoFactorMethod, TwoFactorTier } from "@app/types/two-factor-enforcement"

import { ContextForScreen } from "../helper"
import { flushEffects } from "../../helpers/flush-effects"

loadLocale("en")
const LL = i18nObject("en")

type RemovalEvent = { data: { action: { type: string } }; preventDefault: jest.Mock }
type RemovalListener = (event: RemovalEvent) => void

const removalBy = (type: string): RemovalEvent => ({
  data: { action: { type } },
  preventDefault: jest.fn(),
})

const mockNavigate = jest.fn()
const mockGoBack = jest.fn()
const mockSetOptions = jest.fn()
const mockRemoveListener = jest.fn()
const mockAddListener = jest.fn(
  (_name: string, _listener: RemovalListener) => mockRemoveListener,
)
let mockIsFocused = true

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: mockGoBack,
    setOptions: mockSetOptions,
    addListener: mockAddListener,
  }),
  useIsFocused: () => mockIsFocused,
}))

const removalListenerInstalls = () =>
  mockAddListener.mock.calls.filter(([name]) => name === "beforeRemove")

/** The listener the screen installed against being removed, if any. */
const installedRemovalListener = (): RemovalListener | undefined =>
  removalListenerInstalls()[0]?.[1]

const mockEnforcement = {
  tier: TwoFactorTier.Nudge as TwoFactorTier,
  hasTwoFactor: false,
  missingMethod: TwoFactorMethod.Email as TwoFactorMethod,
  unverifiedEmail: null as string | null,
  shouldShowNudgeCard: true,
  shouldShowSettingsBanner: true,
  dismissNudgeCard: jest.fn(),
}
jest.mock("@app/custodial/providers/two-factor-enforcement", () => ({
  useTwoFactorEnforcement: () => mockEnforcement,
}))

const mockPromptReverification = jest.fn()
const mockUseEmailReverification = jest.fn((_options?: { returnTo?: string }) => ({
  promptReverification: (...args: unknown[]) => mockPromptReverification(...args),
  spinner: mockIsReverifying,
  isAskedHere: mockIsReverifying && mockIsAskedHere,
}))
let mockIsReverifying = false
/** A re-verification in flight was asked for from this screen, unless a test says it
 *  was joined from elsewhere. */
let mockIsAskedHere = true
jest.mock("@app/hooks/use-email-reverification", () => ({
  useEmailReverification: (options?: { returnTo?: string }) =>
    mockUseEmailReverification(options),
}))

const mockLogTwoFactorSetupStarted = jest.fn()
jest.mock("@app/utils/analytics", () => ({
  logTwoFactorSetupStarted: (...args: unknown[]) => mockLogTwoFactorSetupStarted(...args),
}))

const renderScreen = async () => {
  const rendered = render(
    <ContextForScreen>
      <TwoFactorSetupScreen />
    </ContextForScreen>,
  )
  await flushEffects()
  return rendered
}

const rerenderScreen = async (rendered: ReturnType<typeof render>) => {
  rendered.rerender(
    <ContextForScreen>
      <TwoFactorSetupScreen />
    </ContextForScreen>,
  )
  await flushEffects()
}

/** The control is rendered on its own: the navigation it needs is the mock above, and
 *  the screen providers would only add async account loads that outlive the test. */
const renderInstalledCloseControl = () => {
  const { headerRight } = mockSetOptions.mock.calls[0][0]
  render(<ThemeProvider theme={theme}>{headerRight({ canGoBack: true })}</ThemeProvider>)
}

describe("TwoFactorSetupScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    loadLocale("en")
    mockIsFocused = true
    mockIsReverifying = false
    mockIsAskedHere = true
    mockEnforcement.tier = TwoFactorTier.Nudge
    mockEnforcement.hasTwoFactor = false
    mockEnforcement.missingMethod = TwoFactorMethod.Email
    mockEnforcement.unverifiedEmail = null
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it("renders the lock hero with the setup copy", async () => {
    await renderScreen()

    expect(screen.getByTestId("icon-lock-closed")).toBeTruthy()
    expect(screen.getByText(LL.TwoFactorEnforcement.setupTitle())).toBeTruthy()
    expect(screen.getByText(LL.TwoFactorEnforcement.setupDescription())).toBeTruthy()
    expect(screen.getByText(LL.TwoFactorEnforcement.setAuthenticator())).toBeTruthy()
    expect(mockGoBack).not.toHaveBeenCalled()
  })

  it("offers to add an email when that is the missing factor, told to return here", async () => {
    await renderScreen()

    fireEvent.press(screen.getByText(LL.TwoFactorEnforcement.addEmail()))

    expect(mockNavigate).toHaveBeenCalledWith("emailRegistrationInitiate", {
      returnTo: "twoFactorSetup",
    })
    expect(mockPromptReverification).not.toHaveBeenCalled()
    expect(mockLogTwoFactorSetupStarted).toHaveBeenCalledWith({
      tier: TwoFactorTier.Nudge,
      method: TwoFactorMethod.Email,
    })
  })

  it("sends an address that was never verified through re-verification, told to return here", async () => {
    mockEnforcement.unverifiedEmail = "someone@example.com"
    await renderScreen()

    fireEvent.press(screen.getByText(LL.TwoFactorEnforcement.addEmail()))

    expect(mockPromptReverification).toHaveBeenCalledWith("someone@example.com")
    expect(mockUseEmailReverification).toHaveBeenLastCalledWith({
      returnTo: "twoFactorSetup",
    })
    expect(mockNavigate).not.toHaveBeenCalled()
    expect(mockLogTwoFactorSetupStarted).toHaveBeenCalledWith({
      tier: TwoFactorTier.Nudge,
      method: TwoFactorMethod.Email,
    })
  })

  it("holds both flows while a re-verification is in flight", async () => {
    mockEnforcement.unverifiedEmail = "someone@example.com"
    mockIsReverifying = true
    await renderScreen()

    /** The missing-factor button shows its spinner in place of its title while it is
     *  held, so there is no label to press; its disabled state is what keeps a second
     *  re-verification from starting. */
    // eslint-disable-next-line camelcase
    const secondary = screen.UNSAFE_getByType(GaloySecondaryButton)
    expect(secondary.props.loading).toBe(true)
    expect(secondary.props.disabled).toBe(true)

    fireEvent.press(screen.getByText(LL.TwoFactorEnforcement.setAuthenticator()))

    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it("refuses every way back while a re-verification is in flight, but not a reset", async () => {
    mockEnforcement.unverifiedEmail = "someone@example.com"
    mockIsReverifying = true
    await renderScreen()

    const listener = installedRemovalListener()
    const back = removalBy("GO_BACK")
    const pop = removalBy("POP")
    const reset = removalBy("RESET")
    listener?.(back)
    listener?.(pop)
    listener?.(reset)

    expect(back.preventDefault).toHaveBeenCalledTimes(1)
    expect(pop.preventDefault).toHaveBeenCalledTimes(1)
    expect(reset.preventDefault).not.toHaveBeenCalled()
    expect(mockSetOptions).toHaveBeenLastCalledWith(
      expect.objectContaining({ gestureEnabled: false }),
    )
  })

  it("shows the spinner but holds nothing for a re-verification joined from elsewhere", async () => {
    mockEnforcement.unverifiedEmail = "someone@example.com"
    mockIsReverifying = true
    mockIsAskedHere = false
    await renderScreen()

    // eslint-disable-next-line camelcase
    const secondary = screen.UNSAFE_getByType(GaloySecondaryButton)
    expect(secondary.props.loading).toBe(true)
    expect(installedRemovalListener()).toBeUndefined()
    expect(mockSetOptions).toHaveBeenLastCalledWith(
      expect.objectContaining({ gestureEnabled: true }),
    )
  })

  it("can be left the usual ways while nothing is in flight", async () => {
    await renderScreen()

    expect(installedRemovalListener()).toBeUndefined()
    expect(mockSetOptions).toHaveBeenLastCalledWith(
      expect.objectContaining({ gestureEnabled: true }),
    )
  })

  it("releases the hold once the re-verification is done", async () => {
    mockEnforcement.unverifiedEmail = "someone@example.com"
    mockIsReverifying = true
    const rendered = await renderScreen()

    mockIsReverifying = false
    await rerenderScreen(rendered)

    expect(mockRemoveListener).toHaveBeenCalledTimes(1)
    expect(mockSetOptions).toHaveBeenLastCalledWith(
      expect.objectContaining({ gestureEnabled: true }),
    )
  })

  /** `setImmediate` stays real so that the effects settle; the hold's own timer is
   *  the one driven. */
  it("lets the user leave once the hold has run past its deadline, and holds again for a new run", async () => {
    jest.useFakeTimers({ doNotFake: ["setImmediate"] })
    mockEnforcement.unverifiedEmail = "someone@example.com"
    mockIsReverifying = true
    const rendered = await renderScreen()
    expect(installedRemovalListener()).toBeDefined()

    act(() => {
      jest.runOnlyPendingTimers()
    })
    await flushEffects()

    expect(mockRemoveListener).toHaveBeenCalledTimes(1)
    expect(mockSetOptions).toHaveBeenLastCalledWith(
      expect.objectContaining({ gestureEnabled: true }),
    )

    mockIsReverifying = false
    await rerenderScreen(rendered)
    mockIsReverifying = true
    await rerenderScreen(rendered)

    expect(removalListenerInstalls()).toHaveLength(2)
    expect(mockSetOptions).toHaveBeenLastCalledWith(
      expect.objectContaining({ gestureEnabled: false }),
    )
  })

  it("steps aside for a complete account only once the hold has lifted", async () => {
    mockEnforcement.hasTwoFactor = true
    mockIsReverifying = true
    const rendered = await renderScreen()

    expect(mockGoBack).not.toHaveBeenCalled()

    mockIsReverifying = false
    await rerenderScreen(rendered)

    expect(mockGoBack).toHaveBeenCalledTimes(1)
  })

  it("offers to add a phone number when the email is already verified", async () => {
    mockEnforcement.missingMethod = TwoFactorMethod.Phone
    mockEnforcement.tier = TwoFactorTier.Required
    await renderScreen()

    expect(screen.queryByText(LL.TwoFactorEnforcement.addEmail())).toBeNull()
    fireEvent.press(screen.getByText(LL.TwoFactorEnforcement.addPhoneNumber()))

    expect(mockNavigate).toHaveBeenCalledWith("phoneRegistrationInitiate")
    expect(mockLogTwoFactorSetupStarted).toHaveBeenCalledWith({
      tier: TwoFactorTier.Required,
      method: TwoFactorMethod.Phone,
    })
  })

  it("offers the authenticator as the call to action, told to return here", async () => {
    await renderScreen()

    fireEvent.press(screen.getByText(LL.TwoFactorEnforcement.setAuthenticator()))

    expect(mockNavigate).toHaveBeenCalledWith("totpRegistrationInitiate", {
      returnTo: "twoFactorSetup",
    })
    expect(mockLogTwoFactorSetupStarted).toHaveBeenCalledWith({
      tier: TwoFactorTier.Nudge,
      method: TwoFactorMethod.Authenticator,
    })
  })

  it("makes the authenticator the primary button and the missing factor the secondary one", async () => {
    await renderScreen()

    // eslint-disable-next-line camelcase
    const primary = screen.UNSAFE_getByType(GaloyPrimaryButton)
    // eslint-disable-next-line camelcase
    const secondary = screen.UNSAFE_getByType(GaloySecondaryButton)

    expect(primary.props.title).toBe(LL.TwoFactorEnforcement.setAuthenticator())
    expect(secondary.props.title).toBe(LL.TwoFactorEnforcement.addEmail())
  })

  it("keeps the authenticator primary when the phone number is the missing factor", async () => {
    mockEnforcement.missingMethod = TwoFactorMethod.Phone
    await renderScreen()

    // eslint-disable-next-line camelcase
    const primary = screen.UNSAFE_getByType(GaloyPrimaryButton)
    // eslint-disable-next-line camelcase
    const secondary = screen.UNSAFE_getByType(GaloySecondaryButton)

    expect(primary.props.title).toBe(LL.TwoFactorEnforcement.setAuthenticator())
    expect(secondary.props.title).toBe(LL.TwoFactorEnforcement.addPhoneNumber())
  })

  it("installs a close control that leaves the screen", async () => {
    await renderScreen()

    renderInstalledCloseControl()
    fireEvent.press(screen.getByTestId("icon-close"))

    expect(mockGoBack).toHaveBeenCalledTimes(1)
  })

  it("steps aside once the account holds two factors", async () => {
    const rendered = await renderScreen()

    mockEnforcement.hasTwoFactor = true
    await rerenderScreen(rendered)

    expect(mockGoBack).toHaveBeenCalledTimes(1)
  })

  it("stays put while another screen is on top, even with two factors", async () => {
    mockIsFocused = false
    mockEnforcement.hasTwoFactor = true

    await renderScreen()

    expect(mockGoBack).not.toHaveBeenCalled()
  })
})
