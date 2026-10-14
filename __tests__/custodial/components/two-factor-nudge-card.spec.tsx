import React from "react"
import { fireEvent, render } from "@testing-library/react-native"

import { TwoFactorNudgeCard } from "@app/custodial/components/two-factor-nudge-card"
import { TwoFactorTier } from "@app/types/two-factor-enforcement"

const mockNavigate = jest.fn()

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate }),
}))

jest.mock("@rn-vui/themed", () => {
  const colors = {
    grey2: "#999",
    grey5: "#f5f5f5",
    primary: "#007",
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

const mockLogTwoFactorPromptShown = jest.fn()
const mockLogTwoFactorPromptDismissed = jest.fn()
jest.mock("@app/utils/analytics", () => ({
  logTwoFactorPromptShown: (...args: unknown[]) => mockLogTwoFactorPromptShown(...args),
  logTwoFactorPromptDismissed: (...args: unknown[]) =>
    mockLogTwoFactorPromptDismissed(...args),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      TwoFactorEnforcement: {
        title: () => "Set two-factor authentication",
        cardDescription: () => "Protect your account from unauthorized access.",
        cardCta: () => "Set",
      },
    },
  }),
}))

describe("TwoFactorNudgeCard", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("renders the title, body and Set button", () => {
    const { getByText } = render(
      <TwoFactorNudgeCard tier={TwoFactorTier.Nudge} onDismiss={jest.fn()} />,
    )

    expect(getByText("Set two-factor authentication")).toBeTruthy()
    expect(getByText("Protect your account from unauthorized access.")).toBeTruthy()
    expect(getByText("Set")).toBeTruthy()
  })

  it("logs the prompt as shown for its tier", () => {
    render(<TwoFactorNudgeCard tier={TwoFactorTier.Required} onDismiss={jest.fn()} />)

    expect(mockLogTwoFactorPromptShown).toHaveBeenCalledTimes(1)
    expect(mockLogTwoFactorPromptShown).toHaveBeenCalledWith({
      tier: TwoFactorTier.Required,
      prompt: "home_card",
    })
  })

  it("opens the setup screen from Set", () => {
    const { getByTestId } = render(
      <TwoFactorNudgeCard tier={TwoFactorTier.Nudge} onDismiss={jest.fn()} />,
    )

    fireEvent.press(getByTestId("cta-button"))

    expect(mockNavigate).toHaveBeenCalledWith("twoFactorSetup")
  })

  it("dismisses through the X and logs it", () => {
    const onDismiss = jest.fn()
    const { getByTestId } = render(
      <TwoFactorNudgeCard tier={TwoFactorTier.Nudge} onDismiss={onDismiss} />,
    )

    fireEvent.press(getByTestId("dismiss-button"))

    expect(onDismiss).toHaveBeenCalledTimes(1)
    expect(mockLogTwoFactorPromptDismissed).toHaveBeenCalledWith({
      tier: TwoFactorTier.Nudge,
      prompt: "home_card",
    })
  })
})
