import React from "react"
import { StyleSheet, TouchableOpacity } from "react-native"
import { fireEvent, render } from "@testing-library/react-native"

import { TwoFactorReminderBulletin } from "@app/custodial/components/two-factor-reminder-bulletin"
import {
  TwoFactorReminderReason,
  TwoFactorPrompt,
} from "@app/types/two-factor-enforcement"

const mockNavigate = jest.fn()

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate }),
}))

jest.mock("@rn-vui/themed", () => {
  const colors = {
    grey2: "#999",
    grey5: "#f5f5f5",
    primary: "#fa0",
    black: "#000",
    white: "#fff",
  }
  return {
    makeStyles:
      (fn: (theme: { colors: typeof colors }) => Record<string, object>) => () =>
        fn({ colors }),
    Text: ({ children, ...props }: { children: React.ReactNode }) =>
      React.createElement("Text", props, children),
    useTheme: () => ({ theme: { colors } }),
  }
})

jest.mock("@app/components/atomic/galoy-icon", () => ({
  GaloyIcon: () => null,
}))

jest.mock("@app/components/atomic/galoy-icon-button", () => ({
  GaloyIconButton: ({ onPress }: { onPress: () => void }) =>
    React.createElement("Pressable", { onPress, testID: "dismiss-button" }),
}))

jest.mock("@app/components/atomic/galoy-primary-button", () => ({
  GaloyPrimaryButton: ({ onPress, title }: { onPress: () => void; title: string }) =>
    React.createElement(
      "Pressable",
      { onPress, testID: "cta-button" },
      React.createElement("Text", {}, title),
    ),
}))

const mockMarkPromptShown = jest.fn()
const mockDismissReminderBulletin = jest.fn()
let mockReminderReason: TwoFactorReminderReason | null =
  TwoFactorReminderReason.FirstSessions
jest.mock("@app/custodial/providers/two-factor-enforcement", () => ({
  useTwoFactorEnforcement: () => ({
    reminderReason: mockReminderReason,
    markPromptShown: mockMarkPromptShown,
    dismissReminderBulletin: mockDismissReminderBulletin,
  }),
}))

const TITLE = "Add an authenticator to protect your funds"
const DESCRIPTION =
  "Your balance has grown. An authenticator app keeps your account safe, even if someone gets hold of your email or phone."

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      TwoFactorEnforcement: {
        reminderTitle: () => "Add an authenticator to protect your funds",
        reminderDescription: () =>
          "Your balance has grown. An authenticator app keeps your account safe, even if someone gets hold of your email or phone.",
        setAuthenticator: () => "Set authenticator",
      },
    },
  }),
}))

describe("TwoFactorReminderBulletin", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockReminderReason = TwoFactorReminderReason.FirstSessions
  })

  it("renders the title, the text and Set authenticator, with no amount and no countdown", () => {
    const { getByText, queryByText } = render(<TwoFactorReminderBulletin />)

    expect(getByText(TITLE)).toBeTruthy()
    expect(getByText(DESCRIPTION)).toBeTruthy()
    expect(getByText("Set authenticator")).toBeTruthy()
    expect(queryByText(/dismiss this/)).toBeNull()
  })

  it("is outlined in the primary colour, so it reads as more than the nudge", () => {
    const bulletin = render(<TwoFactorReminderBulletin />)
    // eslint-disable-next-line camelcase
    const card = bulletin.UNSAFE_getByType(TouchableOpacity)

    expect(StyleSheet.flatten(card.props.style)).toMatchObject({
      borderWidth: 1,
      borderColor: "#fa0",
    })
  })

  it("reports itself as shown with the reason it is up for", () => {
    mockReminderReason = TwoFactorReminderReason.NewAllTimeHigh
    render(<TwoFactorReminderBulletin />)

    expect(mockMarkPromptShown).toHaveBeenCalledTimes(1)
    expect(mockMarkPromptShown).toHaveBeenCalledWith(
      TwoFactorPrompt.ReminderBulletin,
      TwoFactorReminderReason.NewAllTimeHigh,
    )
  })

  it("reports nothing while the bulletin has no reason to be up", () => {
    mockReminderReason = null
    render(<TwoFactorReminderBulletin />)

    expect(mockMarkPromptShown).not.toHaveBeenCalled()
  })

  it("opens the setup from Set authenticator", () => {
    const { getByTestId } = render(<TwoFactorReminderBulletin />)

    fireEvent.press(getByTestId("cta-button"))

    expect(mockNavigate).toHaveBeenCalledWith("twoFactorSetup")
  })

  it("hands the X to the enforcement's dismissal", () => {
    const { getByTestId } = render(<TwoFactorReminderBulletin />)

    fireEvent.press(getByTestId("dismiss-button"))

    expect(mockDismissReminderBulletin).toHaveBeenCalledTimes(1)
  })
})
