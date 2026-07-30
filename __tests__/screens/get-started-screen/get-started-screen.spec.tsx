import React from "react"
import { fireEvent, render } from "@testing-library/react-native"

import { GetStartedScreen } from "@app/screens/get-started-screen/get-started-screen"

const mockNavigate = jest.fn()
const mockSetOptions = jest.fn()
const mockCanGoBack = jest.fn(() => false)
const mockUseFeatureFlags = jest.fn()
const mockUseAccountTypeOptions = jest.fn()
const mockIsCreationBlocked = jest.fn()
const mockRegionLoading = jest.fn(() => false)

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
    appConfig: { galoyInstance: { id: "Main" } },
  }),
}))

jest.mock("@app/hooks/use-account-type-options", () => ({
  AccountOption: { Custodial: "custodial", SelfCustodial: "selfCustodial" },
  AccountFlow: { Trial: "trial", SelfCustodial: "selfCustodial" },
  ACCOUNT_OPTION_TO_FLOW: { custodial: "trial", selfCustodial: "selfCustodial" },
  useAccountTypeOptions: () => mockUseAccountTypeOptions(),
}))

let mockIsAnonMode = false
const mockPromptEnhancedMode = jest.fn()
jest.mock("@app/self-custodial/hooks/use-self-custodial-account-mode", () => ({
  useSelfCustodialAccountMode: () => ({ isAnonMode: mockIsAnonMode }),
}))
jest.mock("@app/components/enhanced-mode-prompt", () => ({
  useEnhancedModePrompt: () => ({ promptEnhancedMode: mockPromptEnhancedMode }),
}))

jest.mock("@app/hooks/use-creation-block", () => ({
  useCreationBlock: () => ({
    isCreationBlocked: mockIsCreationBlocked,
    loading: mockRegionLoading(),
  }),
}))

jest.mock("@app/screens/get-started-screen/use-device-token", () => ({
  __esModule: true,
  default: () => null,
}))

jest.mock("@app/utils/analytics", () => ({
  logGetStartedAction: jest.fn(),
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
    useTheme: () => ({ theme: { mode: "dark" } }),
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
    mockIsAnonMode = false
    mockIsCreationBlocked.mockReturnValue(false)
    mockRegionLoading.mockReturnValue(false)
    mockUseFeatureFlags.mockReturnValue({
      deviceAccountEnabled: false,
      nonCustodialEnabled: true,
    })
    mockUseAccountTypeOptions.mockReturnValue({
      options: ["selfCustodial", "custodial"],
      defaultSelected: null,
      selfCustodialTemporarilyDisabled: false,
      loading: false,
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

  it("disables Create new account when no options are available", () => {
    mockUseFeatureFlags.mockReturnValue({
      deviceAccountEnabled: false,
      nonCustodialEnabled: false,
    })
    mockUseAccountTypeOptions.mockReturnValue({
      options: [],
      defaultSelected: null,
      selfCustodialTemporarilyDisabled: true,
      loading: false,
    })

    const { getByTestId } = render(<GetStartedScreen />)
    const button = getByTestId("create-account-button")

    expect(button.props.accessibilityState.disabled).toBe(true)

    fireEvent.press(button)
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it("disables Create new account while detecting the country and ignores presses", () => {
    mockUseAccountTypeOptions.mockReturnValue({
      options: [],
      defaultSelected: null,
      selfCustodialTemporarilyDisabled: false,
      loading: true,
    })

    const { getByTestId } = render(<GetStartedScreen />)
    const button = getByTestId("create-account-button")

    expect(button.props.accessibilityState.disabled).toBe(true)

    fireEvent.press(button)
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it("routes to the selection screen when non-custodial is enabled and at least one option exists", () => {
    const { getByTestId } = render(<GetStartedScreen />)

    fireEvent.press(getByTestId("create-account-button"))

    expect(mockNavigate).toHaveBeenCalledWith("accountTypeSelection", { mode: "create" })
  })

  /** A single offered type is submitted here rather than on the account type screen, which
   *  is the only other place wired to the mode screen. Skipping straight to terms provisions
   *  the account with no mode, and nothing asks again. */
  it("routes through the mode screen when only the self-custodial option exists (e.g. US)", () => {
    mockUseAccountTypeOptions.mockReturnValue({
      options: ["selfCustodial"],
      defaultSelected: "selfCustodial",
      selfCustodialTemporarilyDisabled: false,
      loading: false,
    })

    const { getByTestId } = render(<GetStartedScreen />)
    fireEvent.press(getByTestId("create-account-button"))

    expect(mockNavigate).toHaveBeenCalledWith("selfCustodialChooseExperience", {
      onContinue: { route: "acceptTermsAndConditions" },
    })
    expect(mockNavigate).not.toHaveBeenCalledWith(
      "acceptTermsAndConditions",
      expect.anything(),
    )
  })

  it("offers the Enhanced prompt instead of creating an account in Anon mode", () => {
    mockIsAnonMode = true

    const { getByTestId } = render(<GetStartedScreen />)
    fireEvent.press(getByTestId("create-account-button"))

    expect(mockPromptEnhancedMode).toHaveBeenCalledTimes(1)
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it("routes directly to trial T&C when non-custodial is off but custodial is allowed", () => {
    mockUseFeatureFlags.mockReturnValue({
      deviceAccountEnabled: false,
      nonCustodialEnabled: false,
    })
    mockUseAccountTypeOptions.mockReturnValue({
      options: ["custodial"],
      defaultSelected: "custodial",
      selfCustodialTemporarilyDisabled: true,
      loading: false,
    })

    const { getByTestId } = render(<GetStartedScreen />)
    fireEvent.press(getByTestId("create-account-button"))

    expect(mockNavigate).toHaveBeenCalledWith("acceptTermsAndConditions", {
      flow: "trial",
    })
    /** The mode is a self-custodial concern: a custodial creation must not be diverted. */
    expect(mockNavigate).not.toHaveBeenCalledWith(
      "selfCustodialChooseExperience",
      expect.anything(),
    )
  })

  it("redirects to Unsupported region when every available option is region-blocked", () => {
    mockIsCreationBlocked.mockReturnValue(true)

    const { getByTestId } = render(<GetStartedScreen />)
    fireEvent.press(getByTestId("create-account-button"))

    expect(mockNavigate).toHaveBeenCalledWith("unsupportedRegion")
    expect(mockNavigate).not.toHaveBeenCalledWith("accountTypeSelection", {
      mode: "create",
    })
  })

  it("proceeds to the selection screen when at least one option is not region-blocked", () => {
    mockIsCreationBlocked.mockImplementation(
      (option: string) => option === "selfCustodial",
    )

    const { getByTestId } = render(<GetStartedScreen />)
    fireEvent.press(getByTestId("create-account-button"))

    expect(mockNavigate).toHaveBeenCalledWith("accountTypeSelection", { mode: "create" })
    expect(mockNavigate).not.toHaveBeenCalledWith("unsupportedRegion")
  })

  it("redirects when the only available option is region-blocked (non-custodial off, custodial blocked)", () => {
    mockUseFeatureFlags.mockReturnValue({
      deviceAccountEnabled: false,
      nonCustodialEnabled: false,
    })
    mockUseAccountTypeOptions.mockReturnValue({
      options: ["custodial"],
      defaultSelected: "custodial",
      selfCustodialTemporarilyDisabled: true,
      loading: false,
    })
    mockIsCreationBlocked.mockReturnValue(true)

    const { getByTestId } = render(<GetStartedScreen />)
    fireEvent.press(getByTestId("create-account-button"))

    expect(mockNavigate).toHaveBeenCalledWith("unsupportedRegion")
    expect(mockNavigate).not.toHaveBeenCalledWith("acceptTermsAndConditions", {
      flow: "trial",
    })
  })

  it("disables Create new account while detecting the region and ignores presses", () => {
    mockRegionLoading.mockReturnValue(true)

    const { getByTestId } = render(<GetStartedScreen />)
    const button = getByTestId("create-account-button")

    expect(button.props.accessibilityState.disabled).toBe(true)

    fireEvent.press(button)
    expect(mockNavigate).not.toHaveBeenCalled()
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
      loading: false,
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
