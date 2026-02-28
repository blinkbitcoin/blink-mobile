import React from "react"
import { Text as RNText, View } from "react-native"
import { render, fireEvent } from "@testing-library/react-native"

import { ReplaceCardLayout } from "@app/screens/card-screen/replace-card-screens/replace-card-layout"

jest.mock("@rn-vui/themed", () => ({
  Text: (props: React.ComponentProps<typeof RNText>) => <RNText {...props} />,
  useTheme: () => ({
    theme: {
      colors: {
        black: "#000000",
        primary: "#3B82F6",
        grey2: "#666666",
        grey5: "#F5F5F5",
      },
    },
  }),
  makeStyles: () => () => ({
    container: {},
    progressBarContainer: {},
    headerSection: {},
    textContainer: {},
    title: {},
    subtitle: {},
    content: {},
    buttonContainer: {},
  }),
}))

jest.mock("@app/components/screen", () => ({
  Screen: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
}))

jest.mock("@app/components/atomic/galoy-icon", () => ({
  GaloyIcon: ({ name, color }: { name: string; size: number; color: string }) => (
    <View testID={`galoy-icon-${name}`} accessibilityHint={color}>
      <RNText>{name}</RNText>
    </View>
  ),
}))

jest.mock("@app/components/atomic/galoy-primary-button", () => ({
  GaloyPrimaryButton: ({
    title,
    onPress,
    disabled,
  }: {
    title: string
    onPress: () => void
    disabled: boolean
  }) => (
    <View
      testID="primary-button"
      accessibilityState={{ disabled }}
      onTouchEnd={disabled ? undefined : onPress}
    >
      <RNText>{title}</RNText>
    </View>
  ),
}))

jest.mock("@app/components/steps-progress-bar", () => ({
  StepsProgressBar: ({
    steps,
    currentStep,
  }: {
    steps: string[]
    currentStep: number
  }) => (
    <View testID="steps-progress-bar">
      <RNText>{`Step ${currentStep} of ${steps.length}`}</RNText>
    </View>
  ),
}))

describe("ReplaceCardLayout", () => {
  const defaultProps = {
    steps: ["Report Issue", "Delivery", "Confirm"],
    currentStep: 1,
    icon: "report-flag" as const,
    title: "Report card Issue",
    subtitle: "Let us know what happened.",
    buttonLabel: "Continue",
    onButtonPress: jest.fn(),
    children: <RNText>Step Content</RNText>,
  }

  beforeEach(jest.clearAllMocks)

  describe("rendering", () => {
    it("renders without crashing", () => {
      const { toJSON } = render(<ReplaceCardLayout {...defaultProps} />)

      expect(toJSON()).toBeTruthy()
    })

    it("displays progress bar", () => {
      const { getByTestId } = render(<ReplaceCardLayout {...defaultProps} />)

      expect(getByTestId("steps-progress-bar")).toBeTruthy()
    })

    it("displays step count", () => {
      const { getByText } = render(<ReplaceCardLayout {...defaultProps} />)

      expect(getByText("Step 1 of 3")).toBeTruthy()
    })

    it("displays icon", () => {
      const { getByTestId } = render(<ReplaceCardLayout {...defaultProps} />)

      expect(getByTestId("galoy-icon-report-flag")).toBeTruthy()
    })

    it("displays title", () => {
      const { getByText } = render(<ReplaceCardLayout {...defaultProps} />)

      expect(getByText("Report card Issue")).toBeTruthy()
    })

    it("displays subtitle", () => {
      const { getByText } = render(<ReplaceCardLayout {...defaultProps} />)

      expect(getByText("Let us know what happened.")).toBeTruthy()
    })

    it("displays children", () => {
      const { getByText } = render(<ReplaceCardLayout {...defaultProps} />)

      expect(getByText("Step Content")).toBeTruthy()
    })

    it("displays button label", () => {
      const { getByText } = render(<ReplaceCardLayout {...defaultProps} />)

      expect(getByText("Continue")).toBeTruthy()
    })
  })

  describe("button", () => {
    it("calls onButtonPress when pressed", () => {
      const { getByTestId } = render(<ReplaceCardLayout {...defaultProps} />)

      fireEvent(getByTestId("primary-button"), "touchEnd")

      expect(defaultProps.onButtonPress).toHaveBeenCalledTimes(1)
    })

    it("disables button when isButtonDisabled is true", () => {
      const { getByTestId } = render(
        <ReplaceCardLayout {...defaultProps} isButtonDisabled={true} />,
      )

      const button = getByTestId("primary-button")
      expect(button.props.accessibilityState).toEqual({ disabled: true })
    })

    it("enables button by default", () => {
      const { getByTestId } = render(<ReplaceCardLayout {...defaultProps} />)

      const button = getByTestId("primary-button")
      expect(button.props.accessibilityState).toEqual({ disabled: false })
    })
  })

  describe("custom icon color", () => {
    it("passes custom icon color", () => {
      const { getByTestId } = render(
        <ReplaceCardLayout {...defaultProps} iconColor="#00FF00" />,
      )

      const icon = getByTestId("galoy-icon-report-flag")
      expect(icon.props.accessibilityHint).toBe("#00FF00")
    })

    it("uses primary color by default", () => {
      const { getByTestId } = render(<ReplaceCardLayout {...defaultProps} />)

      const icon = getByTestId("galoy-icon-report-flag")
      expect(icon.props.accessibilityHint).toBe("#3B82F6")
    })
  })
})
