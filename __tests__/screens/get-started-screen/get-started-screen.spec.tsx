import React from "react"
import { fireEvent, render } from "@testing-library/react-native"

import { GetStartedScreen } from "@app/screens/get-started-screen/get-started-screen"

const mockNavigate = jest.fn()
const mockUseFeatureFlags = jest.fn()
const mockUseAccountTypeOptions = jest.fn()

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}))

jest.mock("@react-navigation/stack", () => ({
  StackNavigationProp: jest.fn(),
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
  useAccountTypeOptions: () => mockUseAccountTypeOptions(),
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
    Screen: ({ children }: { children: React.ReactNode }) =>
      ReactActual.createElement(View, null, children),
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

  it("disables Create new account while detecting the country", () => {
    mockUseAccountTypeOptions.mockReturnValue({
      options: [],
      defaultSelected: null,
      selfCustodialTemporarilyDisabled: false,
      loading: true,
    })

    const { getByTestId } = render(<GetStartedScreen />)
    const button = getByTestId("create-account-button")

    expect(button.props.accessibilityState.disabled).toBe(true)
  })

  it("routes to the selection screen when non-custodial is enabled and at least one option exists", () => {
    const { getByTestId } = render(<GetStartedScreen />)

    fireEvent.press(getByTestId("create-account-button"))

    expect(mockNavigate).toHaveBeenCalledWith("accountTypeSelection", { mode: "create" })
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
  })
})
