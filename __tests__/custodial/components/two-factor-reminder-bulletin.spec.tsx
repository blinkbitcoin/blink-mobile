import React from "react"
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
jest.mock("@app/custodial/providers/two-factor-enforcement", () => ({
  useTwoFactorEnforcement: () => ({
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
  })

  it("renders the title, the text and Set authenticator, with no amount and no countdown", () => {
    const { getByText, queryByText } = render(
      <TwoFactorReminderBulletin reason={TwoFactorReminderReason.FirstSessions} />,
    )

    expect(getByText(TITLE)).toBeTruthy()
    expect(getByText(DESCRIPTION)).toBeTruthy()
    expect(getByText("Set authenticator")).toBeTruthy()
    expect(queryByText(/dismiss this/)).toBeNull()
  })

  it("reports itself as shown with the reason it is up for", () => {
    render(<TwoFactorReminderBulletin reason={TwoFactorReminderReason.NewAllTimeHigh} />)

    expect(mockMarkPromptShown).toHaveBeenCalledTimes(1)
    expect(mockMarkPromptShown).toHaveBeenCalledWith(
      TwoFactorPrompt.ReminderBulletin,
      TwoFactorReminderReason.NewAllTimeHigh,
    )
  })

  /** Its button names the authenticator, so it skips the setup's choice of ways. */
  it("opens the authenticator onboarding from Set authenticator, telling it the bulletin opened it and why", () => {
    const { getByTestId } = render(
      <TwoFactorReminderBulletin reason={TwoFactorReminderReason.FirstSessions} />,
    )

    fireEvent.press(getByTestId("cta-button"))

    expect(mockNavigate).toHaveBeenCalledWith("totpRegistrationIntro", {
      origin: {
        prompt: TwoFactorPrompt.ReminderBulletin,
        reason: TwoFactorReminderReason.FirstSessions,
      },
    })
  })

  it("hands the X to the enforcement's dismissal", () => {
    const { getByTestId } = render(
      <TwoFactorReminderBulletin reason={TwoFactorReminderReason.FirstSessions} />,
    )

    fireEvent.press(getByTestId("dismiss-button"))

    expect(mockDismissReminderBulletin).toHaveBeenCalledTimes(1)
  })
})
