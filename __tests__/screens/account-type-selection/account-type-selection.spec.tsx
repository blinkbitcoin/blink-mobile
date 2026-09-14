import React from "react"
import { fireEvent, render } from "@testing-library/react-native"

import { flushEffects } from "../../helpers/flush-effects"

import { AccountTypeSelectionScreen } from "@app/screens/account-type-selection"

const mockNavigate = jest.fn()
const mockMode = jest.fn()

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
  useRoute: () => ({ params: { mode: mockMode() } }),
}))

jest.mock("@react-navigation/native-stack", () => ({
  NativeStackNavigationProp: jest.fn(),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      AccountTypeSelectionScreen: {
        title: () => "Choose account type",
        descriptionDefault: () => "Please choose your preferred type of Blink.",
        descriptionSelected: () => "Please choose account type.",
        chooseMethod: () => "Choose method",
        custodialLabel: () => "Custodial",
        selfCustodialLabel: () => "Non-custodial",
        custodialDescription: () => "We hold the funds on your behalf",
        selfCustodialDescription: () => "Only you can access funds",
        continueButton: () => "Continue",
        selfCustodialDisabled: () => "Non-custodial is temporarily unavailable.",
        restoreComingSoonTitle: () => "Coming soon",
        restoreComingSoonDescription: () =>
          "Restore flow will be available in a future update.",
      },
    },
  }),
}))

const mockUseAccountTypeOptions = jest.fn()
jest.mock("@app/hooks/use-account-type-options", () => ({
  AccountOption: { Custodial: "custodial", SelfCustodial: "selfCustodial" },
  AccountFlow: { Trial: "trial", SelfCustodial: "selfCustodial" },
  ACCOUNT_OPTION_TO_FLOW: { custodial: "trial", selfCustodial: "selfCustodial" },
  useAccountTypeOptions: () => mockUseAccountTypeOptions(),
}))

const mockCheckBlockReason = jest.fn()
const mockIsChecking = jest.fn(() => false)
const mockIsFirstSignupRuleReady = jest.fn(() => true)

jest.mock("@app/hooks/use-creation-block", () => ({
  useCreationBlock: () => ({
    checkBlockReason: mockCheckBlockReason,
    isChecking: mockIsChecking(),
    isFirstSignupRuleReady: mockIsFirstSignupRuleReady(),
  }),
}))

const mockCardDefaultBg = "#1d1d1d"
const mockCardSelectedBg = "#2B2B2B"
const mockPrimary = "#fc5805"

jest.mock("@rn-vui/themed", () => ({
  makeStyles:
    (fn: (args: { colors: Record<string, string> }) => Record<string, object>) => () =>
      fn({
        colors: {
          primary: "#fc5805",
          grey2: "#949494",
          grey3: "#999",
          grey5: "#1d1d1d",
          grey6: "#2B2B2B",
          black: "#000",
        },
      }),
  Text: ({ children, ...props }: { children: React.ReactNode }) =>
    React.createElement("Text", props, children),
  useTheme: () => ({
    theme: { colors: { primary: "#fc5805", grey5: "#1d1d1d", grey6: "#2B2B2B" } },
  }),
}))

jest.mock("@app/components/atomic/galoy-icon", () => ({
  GaloyIcon: () => React.createElement("View", { testID: "galoy-icon" }),
}))

jest.mock("@app/components/atomic/galoy-primary-button", () => ({
  GaloyPrimaryButton: ({
    title,
    onPress,
    ...props
  }: {
    title: string
    onPress: () => void
  }) =>
    React.createElement(
      "Pressable",
      { onPress, ...props },
      React.createElement("Text", {}, title),
    ),
}))

jest.mock("@app/components/screen", () => ({
  Screen: ({ children }: { children: React.ReactNode }) =>
    React.createElement("View", {}, children),
}))

jest.mock("@app/utils/testProps", () => ({
  testProps: (id: string) => ({ testID: id }),
}))

/**
 * The screen only needs PhoneLoginInitiateType from the barrel, so the barrel is
 * replaced by its leaf module: that keeps the real wire values while leaving the
 * firebase app-check native module out of the test.
 */
jest.mock("@app/screens/phone-auth-screen", () =>
  jest.requireActual("@app/screens/phone-auth-screen/phone-login-initiate-type"),
)

describe("AccountTypeSelectionScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockCheckBlockReason.mockResolvedValue(null)
    mockIsChecking.mockReturnValue(false)
    mockIsFirstSignupRuleReady.mockReturnValue(true)
    mockMode.mockReturnValue("create")
    mockUseAccountTypeOptions.mockReturnValue({
      options: ["selfCustodial", "custodial"],
      defaultSelected: null,
      selfCustodialTemporarilyDisabled: false,
    })
  })

  it("renders title and description", () => {
    const { getByText } = render(<AccountTypeSelectionScreen />)

    expect(getByText("Please choose your preferred type of Blink.")).toBeTruthy()
  })

  it("renders both account options", () => {
    const { getByText } = render(<AccountTypeSelectionScreen />)

    expect(getByText("Custodial")).toBeTruthy()
    expect(getByText("Non-custodial")).toBeTruthy()
  })

  it("renders choose method button when nothing selected", () => {
    const { getByText } = render(<AccountTypeSelectionScreen />)

    expect(getByText("Choose method")).toBeTruthy()
  })

  it("hands self-custodial to the mode choice without locating anyone", async () => {
    mockCheckBlockReason.mockResolvedValue("region")

    const { getByTestId } = render(<AccountTypeSelectionScreen />)

    fireEvent.press(getByTestId("self-custodial-option"))
    fireEvent.press(getByTestId("continue-button"))
    await flushEffects()

    // Anon must read nothing, and the mode is only chosen on the next screen.
    expect(mockCheckBlockReason).not.toHaveBeenCalled()
    expect(mockNavigate).toHaveBeenCalledWith("selfCustodialChooseExperience", {
      onContinue: { route: "acceptTermsAndConditions" },
    })
  })

  it("navigates to T&C with trial flow when custodial selected in create mode", async () => {
    const { getByTestId } = render(<AccountTypeSelectionScreen />)

    fireEvent.press(getByTestId("custodial-option"))
    fireEvent.press(getByTestId("continue-button"))
    await flushEffects()

    expect(mockNavigate).toHaveBeenCalledWith("acceptTermsAndConditions", {
      flow: "trial",
    })
  })

  it("redirects to Unsupported region when custodial is refused in create mode", async () => {
    mockCheckBlockReason.mockResolvedValue("region")

    const { getByTestId } = render(<AccountTypeSelectionScreen />)

    fireEvent.press(getByTestId("custodial-option"))
    fireEvent.press(getByTestId("continue-button"))
    await flushEffects()

    expect(mockNavigate).toHaveBeenCalledWith("unsupportedRegion", { reason: "region" })
    expect(mockNavigate).not.toHaveBeenCalledWith("acceptTermsAndConditions", {
      flow: "trial",
    })
  })

  it("asks only about the option the user picked", async () => {
    mockCheckBlockReason.mockResolvedValue(null)

    const { getByTestId } = render(<AccountTypeSelectionScreen />)

    fireEvent.press(getByTestId("custodial-option"))
    fireEvent.press(getByTestId("continue-button"))
    await flushEffects()

    expect(mockCheckBlockReason).toHaveBeenCalledTimes(1)
    expect(mockCheckBlockReason).toHaveBeenCalledWith("custodial")
  })

  it("does not redirect to Unsupported region in restore mode", async () => {
    mockCheckBlockReason.mockResolvedValue("region")
    mockMode.mockReturnValue("restore")

    const { getByTestId } = render(<AccountTypeSelectionScreen />)

    fireEvent.press(getByTestId("custodial-option"))
    fireEvent.press(getByTestId("continue-button"))
    await flushEffects()

    expect(mockNavigate).not.toHaveBeenCalledWith("unsupportedRegion", expect.anything())
    expect(mockNavigate).toHaveBeenCalledWith("login", {
      type: "Login",
      title: undefined,
      onboarding: undefined,
    })
  })

  it("navigates to login when custodial selected in restore mode", async () => {
    mockMode.mockReturnValue("restore")

    const { getByTestId } = render(<AccountTypeSelectionScreen />)

    fireEvent.press(getByTestId("custodial-option"))
    fireEvent.press(getByTestId("continue-button"))
    await flushEffects()

    expect(mockNavigate).toHaveBeenCalledWith("login", {
      type: "Login",
      title: undefined,
      onboarding: undefined,
    })
  })

  it("navigates to restore method screen for self-custodial restore", async () => {
    mockMode.mockReturnValue("restore")

    const { getByTestId } = render(<AccountTypeSelectionScreen />)

    fireEvent.press(getByTestId("self-custodial-option"))
    fireEvent.press(getByTestId("continue-button"))
    await flushEffects()

    expect(mockNavigate).toHaveBeenCalledWith("selfCustodialRestoreMethod")
  })

  it("does not navigate when nothing selected", async () => {
    const { getByTestId } = render(<AccountTypeSelectionScreen />)

    fireEvent.press(getByTestId("continue-button"))
    await flushEffects()

    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it("uses grey5 as default card background and grey6 when selected", () => {
    const { getByTestId } = render(<AccountTypeSelectionScreen />)

    const custodialCard = getByTestId("custodial-option")
    const selfCustodialCard = getByTestId("self-custodial-option")

    expect(custodialCard.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ backgroundColor: mockCardDefaultBg }),
      ]),
    )
    expect(selfCustodialCard.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ backgroundColor: mockCardDefaultBg }),
      ]),
    )

    fireEvent.press(custodialCard)

    expect(custodialCard.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          backgroundColor: mockCardSelectedBg,
          borderColor: mockPrimary,
        }),
      ]),
    )
  })

  it("preselects the survivor when an option stops being offered", async () => {
    const { getByTestId, rerender } = render(<AccountTypeSelectionScreen />)

    // Remote config can turn self-custodial off after the screen is already up.
    mockUseAccountTypeOptions.mockReturnValue({
      options: ["custodial"],
      defaultSelected: "custodial",
      selfCustodialTemporarilyDisabled: true,
    })
    rerender(<AccountTypeSelectionScreen />)

    fireEvent.press(getByTestId("continue-button"))
    await flushEffects()

    expect(mockCheckBlockReason).toHaveBeenCalledWith("custodial")
  })

  it("holds the cards still while a check is running", () => {
    mockIsChecking.mockReturnValue(true)

    const { getByTestId, getByText } = render(<AccountTypeSelectionScreen />)
    fireEvent.press(getByTestId("custodial-option"))

    // A selection changed mid-check would leave the answer describing the other option,
    // so the button still asks the user to choose rather than offering to continue.
    expect(getByText("Choose method")).toBeTruthy()
  })

  it("waits for the account count before it can refuse a first signup", () => {
    mockIsFirstSignupRuleReady.mockReturnValue(false)

    const { getByTestId } = render(<AccountTypeSelectionScreen />)
    fireEvent.press(getByTestId("custodial-option"))

    expect(getByTestId("continue-button").props.disabled).toBe(true)
  })

  /**
   * The account count is read by the custodial creation alone. Restore navigates straight to
   * login or the restore method, and a self-custodial creation is answered after the mode
   * screen, so holding Continue in those modes waits on a rule that is never consulted. The
   * registry also re-hydrates when the active account changes, which could bring the wait
   * back mid-session and swallow a press.
   */
  it("does not wait for the account count in restore mode", () => {
    mockIsFirstSignupRuleReady.mockReturnValue(false)
    mockMode.mockReturnValue("restore")

    const { getByTestId } = render(<AccountTypeSelectionScreen />)
    fireEvent.press(getByTestId("custodial-option"))

    expect(getByTestId("continue-button").props.disabled).toBe(false)
  })

  it("does not wait for the account count when restoring self-custodial", () => {
    mockIsFirstSignupRuleReady.mockReturnValue(false)
    mockMode.mockReturnValue("restore")

    const { getByTestId } = render(<AccountTypeSelectionScreen />)
    fireEvent.press(getByTestId("self-custodial-option"))

    expect(getByTestId("continue-button").props.disabled).toBe(false)
  })

  /** A self-custodial creation is refused after the mode screen, if at all, so this screen
   *  has nothing to hold it for. */
  it("does not wait for the account count when creating self-custodial", () => {
    mockIsFirstSignupRuleReady.mockReturnValue(false)

    const { getByTestId } = render(<AccountTypeSelectionScreen />)
    fireEvent.press(getByTestId("self-custodial-option"))

    expect(getByTestId("continue-button").props.disabled).toBe(false)
  })

  it("renders only the cards the offered options name", () => {
    mockUseAccountTypeOptions.mockReturnValue({
      options: ["selfCustodial"],
      defaultSelected: "selfCustodial",
      selfCustodialTemporarilyDisabled: false,
    })

    const { queryByTestId } = render(<AccountTypeSelectionScreen />)

    expect(queryByTestId("custodial-option")).toBeNull()
    expect(queryByTestId("self-custodial-option")).toBeTruthy()
  })

  it("pre-selects the only available option and enables the continue button", async () => {
    mockUseAccountTypeOptions.mockReturnValue({
      options: ["selfCustodial"],
      defaultSelected: "selfCustodial",
      selfCustodialTemporarilyDisabled: false,
    })

    const { getByTestId } = render(<AccountTypeSelectionScreen />)

    fireEvent.press(getByTestId("continue-button"))
    await flushEffects()
    expect(mockNavigate).toHaveBeenCalledWith("selfCustodialChooseExperience", {
      onContinue: { route: "acceptTermsAndConditions" },
    })
  })

  it("hides self-custodial card and shows the disabled banner when feature flag is off", () => {
    mockUseAccountTypeOptions.mockReturnValue({
      options: ["custodial"],
      defaultSelected: "custodial",
      selfCustodialTemporarilyDisabled: true,
    })

    const { queryByTestId, getByTestId } = render(<AccountTypeSelectionScreen />)

    expect(queryByTestId("self-custodial-option")).toBeNull()
    expect(queryByTestId("custodial-option")).toBeTruthy()
    expect(getByTestId("self-custodial-disabled-banner")).toBeTruthy()
  })

  it("does not navigate when the check answers after the screen is gone", async () => {
    let resolveCheck: (reason: string | null) => void = () => undefined
    mockCheckBlockReason.mockReturnValue(
      new Promise<string | null>((resolve) => {
        resolveCheck = resolve
      }),
    )

    const { getByTestId, unmount } = render(<AccountTypeSelectionScreen />)
    fireEvent.press(getByTestId("custodial-option"))
    fireEvent.press(getByTestId("continue-button"))
    unmount()

    resolveCheck("region")
    await flushEffects()

    // Pushing a screen onto whatever the user moved to would be a jump they never asked for.
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it("holds the continue button while the check runs", async () => {
    mockIsChecking.mockReturnValue(true)

    const { getByTestId } = render(<AccountTypeSelectionScreen />)
    fireEvent.press(getByTestId("continue-button"))
    await flushEffects()

    expect(mockCheckBlockReason).not.toHaveBeenCalled()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it("leaves the creation rules out of a restore, which creates nothing", async () => {
    mockMode.mockReturnValue("restore")
    mockCheckBlockReason.mockResolvedValue("region")

    const { getByTestId } = render(<AccountTypeSelectionScreen />)
    fireEvent.press(getByTestId("custodial-option"))
    fireEvent.press(getByTestId("continue-button"))
    await flushEffects()

    // A restore opens no account, so it never reads the connection nor is refused for it.
    expect(mockCheckBlockReason).not.toHaveBeenCalled()
    expect(mockNavigate).not.toHaveBeenCalledWith("unsupportedRegion", expect.anything())
  })

  it("renders both options on restore even when running from a country blocked for custodial creation", () => {
    mockMode.mockReturnValue("restore")
    mockUseAccountTypeOptions.mockReturnValue({
      options: ["selfCustodial", "custodial"],
      defaultSelected: null,
      selfCustodialTemporarilyDisabled: false,
    })

    const { getByTestId } = render(<AccountTypeSelectionScreen />)

    expect(getByTestId("custodial-option")).toBeTruthy()
    expect(getByTestId("self-custodial-option")).toBeTruthy()
  })
})
