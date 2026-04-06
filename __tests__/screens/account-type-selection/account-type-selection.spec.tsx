import React from "react"
import { Alert } from "react-native"
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
        restoreComingSoonTitle: () => "Coming soon",
        restoreComingSoonDescription: () =>
          "Restore flow will be available in a future update.",
      },
    },
  }),
}))

jest.mock("@rn-vui/themed", () => ({
  makeStyles:
    (fn: (args: { colors: Record<string, string> }) => Record<string, object>) => () =>
      fn({
        colors: {
          primary: "#000",
          grey2: "#949494",
          grey3: "#999",
          grey5: "#eee",
          black: "#000",
        },
      }),
  Text: ({ children, ...props }: { children: React.ReactNode }) =>
    React.createElement("Text", props, children),
  useTheme: () => ({ theme: { colors: { primary: "#000", grey5: "#eee" } } }),
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

  it("shows alert for self-custodial restore (not yet implemented)", () => {
    mockMode.mockReturnValue("restore")
    const alertSpy = jest.spyOn(Alert, "alert")

    const { getByTestId } = render(<AccountTypeSelectionScreen />)

    fireEvent.press(getByTestId("self-custodial-option"))
    fireEvent.press(getByTestId("continue-button"))

    expect(alertSpy).toHaveBeenCalledWith(
      "Coming soon",
      "Restore flow will be available in a future update.",
    )
  })

  it("does not navigate when nothing selected", () => {
    const { getByTestId } = render(<AccountTypeSelectionScreen />)

    fireEvent.press(getByTestId("continue-button"))

    expect(mockNavigate).not.toHaveBeenCalled()
  })
})
