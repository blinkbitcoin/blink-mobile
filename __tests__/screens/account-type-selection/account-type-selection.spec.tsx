import React from "react"
import { fireEvent, render } from "@testing-library/react-native"

import { AccountTypeSelectionScreen } from "@app/screens/account-type-selection"

const mockNavigate = jest.fn()
const mockMode = jest.fn()

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
  useRoute: () => ({ params: { mode: mockMode() } }),
}))

jest.mock("@react-navigation/stack", () => ({
  StackNavigationProp: jest.fn(),
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
  useAccountTypeOptions: () => mockUseAccountTypeOptions(),
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

jest.mock("@app/screens/phone-auth-screen", () => ({
  PhoneLoginInitiateType: { Login: "Login" },
}))

describe("AccountTypeSelectionScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockMode.mockReturnValue("create")
    mockUseAccountTypeOptions.mockReturnValue({
      options: ["selfCustodial", "custodial"],
      defaultSelected: null,
      selfCustodialTemporarilyDisabled: false,
      loading: false,
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

  it("navigates to T&C with selfCustodial flow when self-custodial selected in create mode", () => {
    const { getByTestId } = render(<AccountTypeSelectionScreen />)

    fireEvent.press(getByTestId("self-custodial-option"))
    fireEvent.press(getByTestId("continue-button"))

    expect(mockNavigate).toHaveBeenCalledWith("acceptTermsAndConditions", {
      flow: "selfCustodial",
    })
  })

  it("navigates to T&C with trial flow when custodial selected in create mode", () => {
    const { getByTestId } = render(<AccountTypeSelectionScreen />)

    fireEvent.press(getByTestId("custodial-option"))
    fireEvent.press(getByTestId("continue-button"))

    expect(mockNavigate).toHaveBeenCalledWith("acceptTermsAndConditions", {
      flow: "trial",
    })
  })

  it("navigates to login when custodial selected in restore mode", () => {
    mockMode.mockReturnValue("restore")

    const { getByTestId } = render(<AccountTypeSelectionScreen />)

    fireEvent.press(getByTestId("custodial-option"))
    fireEvent.press(getByTestId("continue-button"))

    expect(mockNavigate).toHaveBeenCalledWith("login", {
      type: "Login",
      title: undefined,
      onboarding: undefined,
    })
  })

  it("navigates to restore method screen for self-custodial restore", () => {
    mockMode.mockReturnValue("restore")

    const { getByTestId } = render(<AccountTypeSelectionScreen />)

    fireEvent.press(getByTestId("self-custodial-option"))
    fireEvent.press(getByTestId("continue-button"))

    expect(mockNavigate).toHaveBeenCalledWith("sparkRestoreMethodScreen")
  })

  it("does not navigate when nothing selected", () => {
    const { getByTestId } = render(<AccountTypeSelectionScreen />)

    fireEvent.press(getByTestId("continue-button"))

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

  it("hides custodial card when the country does not allow custodial", () => {
    mockUseAccountTypeOptions.mockReturnValue({
      options: ["selfCustodial"],
      defaultSelected: "selfCustodial",
      selfCustodialTemporarilyDisabled: false,
      loading: false,
    })

    const { queryByTestId } = render(<AccountTypeSelectionScreen />)

    expect(queryByTestId("custodial-option")).toBeNull()
    expect(queryByTestId("self-custodial-option")).toBeTruthy()
  })

  it("pre-selects the only available option and enables the continue button", () => {
    mockUseAccountTypeOptions.mockReturnValue({
      options: ["selfCustodial"],
      defaultSelected: "selfCustodial",
      selfCustodialTemporarilyDisabled: false,
      loading: false,
    })

    const { getByTestId } = render(<AccountTypeSelectionScreen />)

    fireEvent.press(getByTestId("continue-button"))
    expect(mockNavigate).toHaveBeenCalledWith("acceptTermsAndConditions", {
      flow: "selfCustodial",
    })
  })

  it("hides self-custodial card and shows the disabled banner when feature flag is off", () => {
    mockUseAccountTypeOptions.mockReturnValue({
      options: ["custodial"],
      defaultSelected: "custodial",
      selfCustodialTemporarilyDisabled: true,
      loading: false,
    })

    const { queryByTestId, getByTestId } = render(<AccountTypeSelectionScreen />)

    expect(queryByTestId("self-custodial-option")).toBeNull()
    expect(queryByTestId("custodial-option")).toBeTruthy()
    expect(getByTestId("self-custodial-disabled-banner")).toBeTruthy()
  })

  it("shows a loader and disables the continue button while detecting the country", () => {
    mockUseAccountTypeOptions.mockReturnValue({
      options: [],
      defaultSelected: null,
      selfCustodialTemporarilyDisabled: false,
      loading: true,
    })

    const { queryByTestId, getByTestId } = render(<AccountTypeSelectionScreen />)

    expect(queryByTestId("custodial-option")).toBeNull()
    expect(queryByTestId("self-custodial-option")).toBeNull()
    fireEvent.press(getByTestId("continue-button"))
    expect(mockNavigate).not.toHaveBeenCalled()
  })
})
