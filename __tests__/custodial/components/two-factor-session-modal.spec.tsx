import React from "react"
import { TouchableOpacity } from "react-native"
import { fireEvent, render } from "@testing-library/react-native"

import { TwoFactorSessionModal } from "@app/custodial/components/two-factor-session-modal"
import { TwoFactorTier } from "@app/types/two-factor-enforcement"

const mockNavigate = jest.fn()

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate }),
}))

jest.mock("@rn-vui/themed", () => {
  const colors = {
    grey0: "#ccc",
    grey2: "#999",
    grey5: "#f5f5f5",
    primary: "#fc5805",
    black: "#000",
    white: "#fff",
  }
  return {
    makeStyles:
      (fn: (...args: unknown[]) => Record<string, object>) => (props?: unknown) =>
        fn({ colors }, props ?? {}),
    Text: ({ children, ...props }: { children: React.ReactNode }) =>
      React.createElement("Text", props, children),
    useTheme: () => ({ theme: { colors, mode: "light" } }),
  }
})

jest.mock("@app/components/atomic/galoy-icon", () => ({
  GaloyIcon: () => null,
}))

jest.mock("@app/components/atomic/galoy-primary-button", () => ({
  GaloyPrimaryButton: ({ onPress, title }: { onPress: () => void; title: string }) =>
    React.createElement(
      "Pressable",
      { onPress, testID: "primary-button" },
      React.createElement("Text", {}, title),
    ),
}))

jest.mock("@app/components/atomic/galoy-secondary-button", () => ({
  GaloySecondaryButton: ({ onPress, title }: { onPress: () => void; title: string }) =>
    React.createElement(
      "Pressable",
      { onPress, testID: "secondary-button" },
      React.createElement("Text", {}, title),
    ),
}))

jest.mock("react-native-modal", () => {
  const MockModal = ({
    children,
    isVisible,
  }: {
    children: React.ReactNode
    isVisible: boolean
  }) => (isVisible ? React.createElement("View", { testID: "modal" }, children) : null)
  MockModal.displayName = "MockModal"
  return MockModal
})

jest.mock("@app/utils/testProps", () => ({
  testProps: (id: string) => ({ testID: id }),
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
        modalReminder: () =>
          "If you dismiss now, make sure to enable it as soon as possible.",
        dismissTwoMore: () => "You can dismiss this two more times.",
        dismissOneMore: () => "You can dismiss this one more time.",
        dismissLast: () => "This is the last time you can dismiss this.",
        setNow: () => "Set now",
        dontWantTo: () => "I don't want to",
      },
    },
  }),
}))

type RenderOptions = {
  isVisible?: boolean
  remainingDismissals?: number
  onDismiss?: () => void
}

const renderModal = ({
  isVisible = true,
  remainingDismissals = 3,
  onDismiss = jest.fn(),
}: RenderOptions = {}) =>
  render(
    <TwoFactorSessionModal
      isVisible={isVisible}
      tier={TwoFactorTier.Recommended}
      remainingDismissals={remainingDismissals}
      onDismiss={onDismiss}
    />,
  )

describe("TwoFactorSessionModal", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("renders the title, both buttons and the reminder when visible", () => {
    const { getByText, getByTestId } = renderModal()

    expect(getByTestId("modal")).toBeTruthy()
    expect(getByText("Set two-factor authentication")).toBeTruthy()
    expect(getByText("Set now")).toBeTruthy()
    expect(getByText("I don't want to")).toBeTruthy()
    expect(
      getByText("If you dismiss now, make sure to enable it as soon as possible."),
    ).toBeTruthy()
  })

  it("stays off screen while hidden", () => {
    const { queryByTestId } = renderModal({ isVisible: false })

    expect(queryByTestId("modal")).toBeNull()
  })

  const countdownCases: ReadonlyArray<readonly [number, string]> = [
    [3, "You can dismiss this two more times."],
    [2, "You can dismiss this one more time."],
    [1, "This is the last time you can dismiss this."],
  ]
  countdownCases.forEach(([remainingDismissals, copy]) => {
    it(`counts down from ${remainingDismissals} remaining dismissals`, () => {
      const { getByText } = renderModal({ remainingDismissals })

      expect(
        getByText(`Protect your account from unauthorized access. ${copy}`),
      ).toBeTruthy()
    })
  })

  it("counts the X as the dismissal and logs it", () => {
    const onDismiss = jest.fn()
    // eslint-disable-next-line camelcase -- testing-library exposes this API verbatim
    const { UNSAFE_getByType } = renderModal({ onDismiss })

    fireEvent.press(UNSAFE_getByType(TouchableOpacity))

    expect(onDismiss).toHaveBeenCalledTimes(1)
    expect(mockLogTwoFactorPromptDismissed).toHaveBeenCalledWith({
      tier: TwoFactorTier.Recommended,
      prompt: "session_modal",
    })
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it("makes way for the setup from Set now without a dismissal", () => {
    const onDismiss = jest.fn()
    const { getByTestId } = renderModal({ onDismiss })

    fireEvent.press(getByTestId("primary-button"))

    expect(onDismiss).not.toHaveBeenCalled()
    expect(mockNavigate).toHaveBeenCalledWith("twoFactorSetup")
  })

  it("makes way for the non-custodial screen from I don't want to", () => {
    const onDismiss = jest.fn()
    const { getByTestId } = renderModal({ onDismiss })

    fireEvent.press(getByTestId("secondary-button"))

    expect(onDismiss).not.toHaveBeenCalled()
    expect(mockNavigate).toHaveBeenCalledWith("twoFactorNonCustodial")
  })

  /** A native modal dismissed while the native-stack push runs can hang, so the modal
   *  hides in the frame of the press; it is back with the home if the flow was left. */
  it("hides in the same frame as the push, and comes back with the home while it is still up", () => {
    const { getByTestId, queryByTestId, rerender } = renderModal()

    fireEvent.press(getByTestId("primary-button"))
    expect(queryByTestId("modal")).toBeNull()

    rerender(
      <TwoFactorSessionModal
        isVisible={false}
        tier={TwoFactorTier.Recommended}
        remainingDismissals={3}
        onDismiss={jest.fn()}
      />,
    )
    rerender(
      <TwoFactorSessionModal
        isVisible={true}
        tier={TwoFactorTier.Recommended}
        remainingDismissals={3}
        onDismiss={jest.fn()}
      />,
    )

    expect(queryByTestId("modal")).toBeTruthy()
  })
})
