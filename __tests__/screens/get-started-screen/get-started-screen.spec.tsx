import React from "react"
import { fireEvent, render } from "@testing-library/react-native"

import { flushEffects } from "../../helpers/flush-effects"

import { GetStartedScreen } from "@app/screens/get-started-screen/get-started-screen"

const mockNavigate = jest.fn()
const mockSetOptions = jest.fn()
const mockCanGoBack = jest.fn(() => false)
const mockUseFeatureFlags = jest.fn()
const mockUseAccountTypeOptions = jest.fn()
const mockCheckBlockReason = jest.fn()
const mockIsChecking = jest.fn(() => false)
const mockIsFirstSignupRuleReady = jest.fn(() => true)
const mockLogGetStartedAction = jest.fn()
let mockInstanceId = "Main"
let mockThemeMode = "dark"

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    setOptions: mockSetOptions,
    canGoBack: mockCanGoBack,
  }),
}))

jest.mock("@react-navigation/native-stack", () => ({
  NativeStackNavigationProp: jest.fn(),
}))

jest.mock("@app/config/feature-flags-context", () => ({
  useFeatureFlags: () => mockUseFeatureFlags(),
}))

jest.mock("@app/hooks", () => ({
  useAppConfig: () => ({
    appConfig: { galoyInstance: { id: mockInstanceId } },
  }),
}))

jest.mock("@app/hooks/use-account-type-options", () => ({
  AccountOption: { Custodial: "custodial", SelfCustodial: "selfCustodial" },
  AccountFlow: { Trial: "trial", SelfCustodial: "selfCustodial" },
  ACCOUNT_OPTION_TO_FLOW: { custodial: "trial", selfCustodial: "selfCustodial" },
  useAccountTypeOptions: () => mockUseAccountTypeOptions(),
}))

jest.mock("@app/hooks/use-creation-block", () => ({
  useCreationBlock: () => ({
    checkBlockReason: mockCheckBlockReason,
    isChecking: mockIsChecking(),
    isFirstSignupRuleReady: mockIsFirstSignupRuleReady(),
  }),
}))

jest.mock("@app/screens/get-started-screen/use-device-token", () => ({
  __esModule: true,
  default: () => null,
}))

/** Pulled in through the phone-auth barrel, and it warns about API keys on import. */
jest.mock("@app/utils/ip-country-lookup", () => ({
  resolveIpCountryCodeCached: jest.fn(),
}))

jest.mock("@app/utils/analytics", () => ({
  logGetStartedAction: (...args: unknown[]) => mockLogGetStartedAction(...args),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      GetStartedScreen: {
        createAccount: () => "Create new account",
        loginOrRestore: () => "Log in or restore",
        login: () => "Login",
      },
    },
  }),
}))

jest.mock("@app/utils/testProps", () => ({
  testProps: (id: string) => ({ testID: id }),
}))

jest.mock("@app/components/atomic/galoy-primary-button", () => {
  const ReactActual = jest.requireActual("react")
  const { TouchableOpacity, Text } = jest.requireActual("react-native")
  return {
    GaloyPrimaryButton: ({
      title,
      onPress,
      disabled,
    }: {
      title: string
      onPress: () => void
      disabled?: boolean
    }) =>
      ReactActual.createElement(
        TouchableOpacity,
        {
          onPress,
          disabled,
          testID: "create-account-button",
          accessibilityState: { disabled },
        },
        ReactActual.createElement(Text, null, title),
      ),
  }
})

jest.mock("@app/components/atomic/galoy-secondary-button", () => {
  const ReactActual = jest.requireActual("react")
  const { TouchableOpacity, Text } = jest.requireActual("react-native")
  return {
    GaloySecondaryButton: ({ title, onPress }: { title: string; onPress: () => void }) =>
      ReactActual.createElement(
        TouchableOpacity,
        { onPress, testID: "login-button" },
        ReactActual.createElement(Text, null, title),
      ),
  }
})

jest.mock("@app/components/screen", () => {
  const ReactActual = jest.requireActual("react")
  const { View } = jest.requireActual("react-native")
  return {
    Screen: ({
      children,
      headerShown,
    }: {
      children: React.ReactNode
      headerShown?: boolean
    }) => ReactActual.createElement(View, { testID: "screen", headerShown }, children),
  }
})

jest.mock("@rn-vui/themed", () => {
  const ReactActual = jest.requireActual("react")
  return {
    makeStyles:
      (fn: (theme: { colors: Record<string, string> }) => Record<string, object>) => () =>
        fn({ colors: { primary: "#fc5805" } }),
    Text: ({ children }: { children: React.ReactNode }) =>
      ReactActual.createElement("Text", null, children),
    useTheme: () => ({ theme: { mode: mockThemeMode } }),
  }
})

jest.mock("@app/rne-theme/theme", () => ({
  __esModule: true,
  default: { darkColors: { _orange: "#fc5805" } },
}))

jest.mock("@app/assets/logo/app-logo-dark.svg", () => "AppLogoDark")
jest.mock("@app/assets/logo/blink-logo-light.svg", () => "AppLogoLight")

describe("GetStartedScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockCanGoBack.mockReturnValue(false)
    mockInstanceId = "Main"
    mockThemeMode = "dark"
    mockCheckBlockReason.mockResolvedValue(null)
    mockIsChecking.mockReturnValue(false)
    mockIsFirstSignupRuleReady.mockReturnValue(true)
    mockUseFeatureFlags.mockReturnValue({
      deviceAccountEnabled: false,
      nonCustodialEnabled: true,
    })
    mockUseAccountTypeOptions.mockReturnValue({
      options: ["selfCustodial", "custodial"],
      defaultSelected: null,
      selfCustodialTemporarilyDisabled: false,
    })
  })

  it("hides the header on a first install, where there is no account to return to", () => {
    const { getByTestId } = render(<GetStartedScreen />)

    expect(mockSetOptions).toHaveBeenCalledWith({ headerShown: false })
    expect(getByTestId("screen").props.headerShown).toBe(false)
  })

  it("shows the header back arrow when opened over an existing account", () => {
    mockCanGoBack.mockReturnValue(true)

    const { getByTestId } = render(<GetStartedScreen />)

    expect(mockSetOptions).toHaveBeenCalledWith({ headerShown: true })
    expect(getByTestId("screen").props.headerShown).toBe(true)
  })

  it("names the instance on every build but production", () => {
    mockInstanceId = "Staging"

    const { getByText } = render(<GetStartedScreen />)

    expect(getByText("Staging")).toBeTruthy()
  })

  it("swaps the logo for the light one under a light theme", () => {
    mockThemeMode = "light"

    const rendered = render(<GetStartedScreen />)

    expect(rendered.root.findAllByType("AppLogoLight" as never)).toHaveLength(1)
  })

  it("locates nobody, on landing or on pressing Create new account", async () => {
    const { getByTestId } = render(<GetStartedScreen />)

    fireEvent.press(getByTestId("create-account-button"))
    await flushEffects()

    // No account type has been chosen yet, so there is nothing to hold against a region.
    expect(mockCheckBlockReason).not.toHaveBeenCalled()
    expect(mockNavigate).toHaveBeenCalledWith("accountTypeSelection", { mode: "create" })
  })

  it("does not navigate when the check answers after the screen is gone", async () => {
    mockUseFeatureFlags.mockReturnValue({
      deviceAccountEnabled: false,
      nonCustodialEnabled: false,
    })
    mockUseAccountTypeOptions.mockReturnValue({
      options: ["custodial"],
      defaultSelected: "custodial",
      selfCustodialTemporarilyDisabled: true,
    })
    let resolveCheck: (reason: string | null) => void = () => undefined
    mockCheckBlockReason.mockReturnValue(
      new Promise<string | null>((resolve) => {
        resolveCheck = resolve
      }),
    )

    const { getByTestId, unmount } = render(<GetStartedScreen />)
    fireEvent.press(getByTestId("create-account-button"))
    unmount()

    resolveCheck("region")
    await flushEffects()

    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it("disables Create new account while the check runs and ignores presses", () => {
    mockIsChecking.mockReturnValue(true)

    const { getByTestId } = render(<GetStartedScreen />)
    const button = getByTestId("create-account-button")

    expect(button.props.accessibilityState.disabled).toBe(true)

    fireEvent.press(button)
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it("routes to the selection screen when non-custodial is enabled and at least one option exists", async () => {
    const { getByTestId } = render(<GetStartedScreen />)

    fireEvent.press(getByTestId("create-account-button"))
    await flushEffects()

    expect(mockNavigate).toHaveBeenCalledWith("accountTypeSelection", { mode: "create" })
  })

  /** A single offered type is submitted here rather than on the account type screen, which
   *  is the only other place wired to the mode screen. Skipping straight to terms provisions
   *  the account with no mode, and nothing asks again. */
  it("routes through the mode screen when only the self-custodial option exists (e.g. US)", async () => {
    mockUseAccountTypeOptions.mockReturnValue({
      options: ["selfCustodial"],
      defaultSelected: "selfCustodial",
      selfCustodialTemporarilyDisabled: false,
    })

    const { getByTestId } = render(<GetStartedScreen />)
    fireEvent.press(getByTestId("create-account-button"))
    await flushEffects()

    expect(mockNavigate).toHaveBeenCalledWith("selfCustodialChooseExperience", {
      onContinue: { route: "acceptTermsAndConditions" },
    })
    expect(mockNavigate).not.toHaveBeenCalledWith(
      "acceptTermsAndConditions",
      expect.anything(),
    )
  })

  it("checks the only option there is, since pressing create is that choice", async () => {
    mockUseFeatureFlags.mockReturnValue({
      deviceAccountEnabled: false,
      nonCustodialEnabled: false,
    })
    mockUseAccountTypeOptions.mockReturnValue({
      options: ["custodial"],
      defaultSelected: "custodial",
      selfCustodialTemporarilyDisabled: true,
    })
    mockCheckBlockReason.mockResolvedValue("firstCustodialSignup")

    const { getByTestId } = render(<GetStartedScreen />)
    fireEvent.press(getByTestId("create-account-button"))
    await flushEffects()

    // Saying the region is closed would overstate a refusal that still leaves an option.
    expect(mockNavigate).toHaveBeenCalledWith("unsupportedRegion", {
      reason: "firstCustodialSignup",
    })
  })

  it("waits for the account count in the build that submits an option here", () => {
    mockUseFeatureFlags.mockReturnValue({
      deviceAccountEnabled: false,
      nonCustodialEnabled: false,
    })
    mockUseAccountTypeOptions.mockReturnValue({
      options: ["custodial"],
      defaultSelected: "custodial",
      selfCustodialTemporarilyDisabled: true,
    })
    mockIsFirstSignupRuleReady.mockReturnValue(false)

    const { getByTestId } = render(<GetStartedScreen />)

    // A registry mid-hydration reads as no accounts, which is what the rule counts.
    expect(getByTestId("create-account-button").props.accessibilityState.disabled).toBe(
      true,
    )
  })

  it("waits on nothing when it has only a screen to navigate to", async () => {
    mockIsFirstSignupRuleReady.mockReturnValue(false)

    const { getByTestId } = render(<GetStartedScreen />)
    fireEvent.press(getByTestId("create-account-button"))
    await flushEffects()

    // No option is submitted here, so no rule this screen evaluates has to settle first.
    expect(getByTestId("create-account-button").props.accessibilityState.disabled).toBe(
      false,
    )
    expect(mockNavigate).toHaveBeenCalledWith("accountTypeSelection", { mode: "create" })
  })

  it("routes directly to trial T&C when non-custodial is off but custodial is allowed", async () => {
    mockUseFeatureFlags.mockReturnValue({
      deviceAccountEnabled: false,
      nonCustodialEnabled: false,
    })
    mockUseAccountTypeOptions.mockReturnValue({
      options: ["custodial"],
      defaultSelected: "custodial",
      selfCustodialTemporarilyDisabled: true,
    })

    const { getByTestId } = render(<GetStartedScreen />)
    fireEvent.press(getByTestId("create-account-button"))
    await flushEffects()

    expect(mockNavigate).toHaveBeenCalledWith("acceptTermsAndConditions", {
      flow: "trial",
    })
    /** The mode is a self-custodial concern: a custodial creation must not be diverted. */
    expect(mockNavigate).not.toHaveBeenCalledWith(
      "selfCustodialChooseExperience",
      expect.anything(),
    )
  })

  it("leaves a closed region to the selection screen rather than pre-empting it", async () => {
    mockCheckBlockReason.mockResolvedValue("region")

    const { getByTestId } = render(<GetStartedScreen />)
    fireEvent.press(getByTestId("create-account-button"))
    await flushEffects()

    // The refusal belongs to whichever option the user picks, which is not known here.
    expect(mockNavigate).toHaveBeenCalledWith("accountTypeSelection", { mode: "create" })
    expect(mockNavigate).not.toHaveBeenCalledWith("unsupportedRegion", expect.anything())
  })

  it("does not count a refused press as the start of a signup", async () => {
    mockUseFeatureFlags.mockReturnValue({
      deviceAccountEnabled: false,
      nonCustodialEnabled: false,
    })
    mockUseAccountTypeOptions.mockReturnValue({
      options: ["custodial"],
      defaultSelected: "custodial",
      selfCustodialTemporarilyDisabled: true,
    })
    mockCheckBlockReason.mockResolvedValue("region")

    const { getByTestId } = render(<GetStartedScreen />)
    fireEvent.press(getByTestId("create-account-button"))
    await flushEffects()

    // Logging every refused retry would inflate the funnel against the terms that follow.
    expect(mockLogGetStartedAction).not.toHaveBeenCalled()
  })

  it("counts the press once the option is allowed", async () => {
    mockUseFeatureFlags.mockReturnValue({
      deviceAccountEnabled: false,
      nonCustodialEnabled: false,
    })
    mockUseAccountTypeOptions.mockReturnValue({
      options: ["custodial"],
      defaultSelected: "custodial",
      selfCustodialTemporarilyDisabled: true,
    })

    const { getByTestId } = render(<GetStartedScreen />)
    fireEvent.press(getByTestId("create-account-button"))
    await flushEffects()

    expect(mockLogGetStartedAction).toHaveBeenCalledWith({
      action: "create_device_account",
      createDeviceAccountEnabled: false,
    })
  })

  it("counts the press that only navigates to the selection screen", async () => {
    const { getByTestId } = render(<GetStartedScreen />)
    fireEvent.press(getByTestId("create-account-button"))
    await flushEffects()

    expect(mockLogGetStartedAction).toHaveBeenCalledWith({
      action: "create_device_account",
      createDeviceAccountEnabled: false,
    })
  })

  it("redirects when the only available option is region-blocked (non-custodial off, custodial blocked)", async () => {
    mockUseFeatureFlags.mockReturnValue({
      deviceAccountEnabled: false,
      nonCustodialEnabled: false,
    })
    mockUseAccountTypeOptions.mockReturnValue({
      options: ["custodial"],
      defaultSelected: "custodial",
      selfCustodialTemporarilyDisabled: true,
    })
    mockCheckBlockReason.mockResolvedValue("region")

    const { getByTestId } = render(<GetStartedScreen />)
    fireEvent.press(getByTestId("create-account-button"))
    await flushEffects()

    expect(mockNavigate).toHaveBeenCalledWith("unsupportedRegion", { reason: "region" })
    expect(mockNavigate).not.toHaveBeenCalledWith("acceptTermsAndConditions", {
      flow: "trial",
    })
  })

  it("routes Login to the selection screen with restore mode when non-custodial is enabled", () => {
    const { getByTestId } = render(<GetStartedScreen />)

    fireEvent.press(getByTestId("login-button"))

    expect(mockNavigate).toHaveBeenCalledWith("accountTypeSelection", { mode: "restore" })
  })

  it("routes Login directly to phone login when non-custodial is off", () => {
    mockUseFeatureFlags.mockReturnValue({
      deviceAccountEnabled: false,
      nonCustodialEnabled: false,
    })
    mockUseAccountTypeOptions.mockReturnValue({
      options: ["custodial"],
      defaultSelected: "custodial",
      selfCustodialTemporarilyDisabled: true,
    })

    const { getByTestId } = render(<GetStartedScreen />)

    fireEvent.press(getByTestId("login-button"))

    expect(mockNavigate).toHaveBeenCalledWith("login", { type: "Login" })
  })

  describe("developer screen secret trigger", () => {
    const originalDev = __DEV__
    const setDev = (value: boolean) => {
      ;(global as unknown as { __DEV__: boolean }).__DEV__ = value
    }

    afterEach(() => {
      setDev(originalDev)
    })

    const tapLogo = (times: number) => {
      const { getByTestId } = render(<GetStartedScreen />)
      const logo = getByTestId("logo-button")
      for (let i = 0; i < times; i += 1) {
        fireEvent.press(logo)
      }
    }

    it("navigates to the developer screen after three logo taps in development builds", () => {
      setDev(true)

      tapLogo(3)

      expect(mockNavigate).toHaveBeenCalledTimes(1)
      expect(mockNavigate).toHaveBeenCalledWith("developerScreen")
    })

    it("does not navigate after three logo taps in release builds", () => {
      setDev(false)

      tapLogo(3)

      expect(mockNavigate).not.toHaveBeenCalled()
    })
  })
})
