import React from "react"
import { Text as RNText, View } from "react-native"
import { render, fireEvent } from "@testing-library/react-native"

import { CardPinLayout } from "@app/screens/card-screen/pin-screens/card-pin-layout"

jest.mock("@rn-vui/themed", () => ({
  Text: (props: React.ComponentProps<typeof RNText>) => <RNText {...props} />,
  useTheme: () => ({
    theme: {
      colors: {
        primary: "#F7931A",
        grey2: "#666666",
        grey5: "#1D1D1D",
        black: "#000000",
        error: "#FF0000",
      },
    },
  }),
  makeStyles: () => () => ({
    screen: {},
    content: {},
    progressBarContainer: {},
    mainContent: {},
    iconContainer: {},
    textContainer: {},
    title: {},
    subtitle: {},
    pinDisplayWrapper: {},
    pinContainer: {},
    pinContainerError: {},
    pinText: {},
    errorText: {},
    buttonWrapper: {},
    keypadContainer: {},
  }),
}))

jest.mock("@app/components/screen", () => ({
  Screen: ({ children, style }: { children: React.ReactNode; style: object }) => (
    <View style={style} testID="screen">
      {children}
    </View>
  ),
}))

jest.mock("@app/components/atomic/galoy-icon", () => ({
  GaloyIcon: ({
    name,
    size,
    color,
  }: {
    name: string
    size: number
    color: string
    backgroundColor: string
    containerSize: number
  }) => (
    <View testID={`galoy-icon-${name}`} accessibilityHint={`${size}-${color}`}>
      <RNText>{name}</RNText>
    </View>
  ),
}))

jest.mock("@app/components/atomic/galoy-primary-button", () => ({
  GaloyPrimaryButton: ({ title, onPress }: { title: string; onPress: () => void }) => (
    <View testID="primary-button">
      <RNText onPress={onPress}>{title}</RNText>
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
      {steps.map((step, index) => (
        <RNText key={step} testID={`step-${index + 1}`}>
          {step}
          {index + 1 === currentStep ? " (current)" : ""}
        </RNText>
      ))}
    </View>
  ),
}))

jest.mock("@app/components/numeric-keypad", () => ({
  NumericKeypad: ({
    onKeyPress,
    disabledKeys,
  }: {
    onKeyPress: (key: string) => void
    disabledKeys: string[]
  }) => (
    <View testID="numeric-keypad">
      {["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", ".", "⌫"].map((key) => (
        <RNText
          key={key}
          testID={`key-${key === "⌫" ? "backspace" : key === "." ? "decimal" : key}`}
          onPress={() => onKeyPress(key)}
          accessibilityState={{ disabled: disabledKeys.includes(key) }}
        >
          {key}
        </RNText>
      ))}
    </View>
  ),
  NumericKey: {
    0: "0",
    1: "1",
    2: "2",
    3: "3",
    4: "4",
    5: "5",
    6: "6",
    7: "7",
    8: "8",
    9: "9",
    Decimal: ".",
    Backspace: "⌫",
  },
}))

describe("CardPinLayout", () => {
  const mockOnPinComplete = jest.fn()
  const mockOnPinChange = jest.fn()
  const mockOnConfirm = jest.fn()

  const defaultProps = {
    steps: ["Set PIN", "Confirm"],
    currentStep: 1,
    title: "Enter your PIN",
    subtitle: "Choose a 4-digit PIN for your card",
    onPinComplete: mockOnPinComplete,
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("rendering", () => {
    it("renders without crashing", () => {
      const { toJSON } = render(<CardPinLayout {...defaultProps} />)

      expect(toJSON()).toBeTruthy()
    })

    it("displays the title", () => {
      const { getByText } = render(<CardPinLayout {...defaultProps} />)

      expect(getByText("Enter your PIN")).toBeTruthy()
    })

    it("displays the subtitle", () => {
      const { getByText } = render(<CardPinLayout {...defaultProps} />)

      expect(getByText("Choose a 4-digit PIN for your card")).toBeTruthy()
    })

    it("renders the key icon", () => {
      const { getByTestId } = render(<CardPinLayout {...defaultProps} />)

      expect(getByTestId("galoy-icon-key-outline")).toBeTruthy()
    })

    it("renders the steps progress bar", () => {
      const { getByTestId } = render(<CardPinLayout {...defaultProps} />)

      expect(getByTestId("steps-progress-bar")).toBeTruthy()
    })

    it("renders the numeric keypad", () => {
      const { getByTestId } = render(<CardPinLayout {...defaultProps} />)

      expect(getByTestId("numeric-keypad")).toBeTruthy()
    })
  })

  describe("steps progress bar", () => {
    it("displays all steps", () => {
      const { getByText } = render(<CardPinLayout {...defaultProps} />)

      expect(getByText(/Set PIN/)).toBeTruthy()
      expect(getByText(/Confirm/)).toBeTruthy()
    })

    it("marks current step correctly", () => {
      const { getByText } = render(<CardPinLayout {...defaultProps} />)

      expect(getByText("Set PIN (current)")).toBeTruthy()
    })

    it("shows step 2 as current when currentStep is 2", () => {
      const { getByText } = render(<CardPinLayout {...defaultProps} currentStep={2} />)

      expect(getByText("Confirm (current)")).toBeTruthy()
    })
  })

  describe("different titles and subtitles", () => {
    it("renders with confirm title", () => {
      const { getByText } = render(
        <CardPinLayout {...defaultProps} title="Confirm your PIN" />,
      )

      expect(getByText("Confirm your PIN")).toBeTruthy()
    })

    it("renders with confirm subtitle", () => {
      const { getByText } = render(
        <CardPinLayout {...defaultProps} subtitle="Re-enter your PIN to confirm" />,
      )

      expect(getByText("Re-enter your PIN to confirm")).toBeTruthy()
    })

    it("renders with change pin title", () => {
      const { getByText } = render(
        <CardPinLayout {...defaultProps} title="Enter current PIN" />,
      )

      expect(getByText("Enter current PIN")).toBeTruthy()
    })
  })

  describe("error message", () => {
    it("does not display error when not provided", () => {
      const { queryByText } = render(<CardPinLayout {...defaultProps} />)

      expect(queryByText("PINs do not match")).toBeNull()
    })

    it("displays error message when provided", () => {
      const { getByText } = render(
        <CardPinLayout {...defaultProps} errorMessage="PINs do not match" />,
      )

      expect(getByText("PINs do not match")).toBeTruthy()
    })

    it("displays incorrect PIN error", () => {
      const { getByText } = render(
        <CardPinLayout {...defaultProps} errorMessage="Incorrect PIN" />,
      )

      expect(getByText("Incorrect PIN")).toBeTruthy()
    })
  })

  describe("confirm button", () => {
    it("does not display button when showConfirmButton is false", () => {
      const { queryByTestId } = render(<CardPinLayout {...defaultProps} />)

      expect(queryByTestId("primary-button")).toBeNull()
    })

    it("does not display button when showConfirmButton is true but no label", () => {
      const { queryByTestId } = render(
        <CardPinLayout {...defaultProps} showConfirmButton={true} />,
      )

      expect(queryByTestId("primary-button")).toBeNull()
    })

    it("does not display button when showConfirmButton is true but no onConfirm", () => {
      const { queryByTestId } = render(
        <CardPinLayout
          {...defaultProps}
          showConfirmButton={true}
          confirmButtonLabel="Confirm"
        />,
      )

      expect(queryByTestId("primary-button")).toBeNull()
    })

    it("displays button when all confirm props are provided", () => {
      const { getByTestId } = render(
        <CardPinLayout
          {...defaultProps}
          showConfirmButton={true}
          confirmButtonLabel="Confirm"
          onConfirm={mockOnConfirm}
        />,
      )

      expect(getByTestId("primary-button")).toBeTruthy()
    })

    it("displays button with correct label", () => {
      const { getByText } = render(
        <CardPinLayout
          {...defaultProps}
          showConfirmButton={true}
          confirmButtonLabel="Confirm PIN"
          onConfirm={mockOnConfirm}
        />,
      )

      expect(getByText("Confirm PIN")).toBeTruthy()
    })
  })

  describe("keypad interactions", () => {
    it("calls onPinComplete when 4 digits are entered", () => {
      const { getByTestId } = render(<CardPinLayout {...defaultProps} />)

      fireEvent.press(getByTestId("key-1"))
      fireEvent.press(getByTestId("key-2"))
      fireEvent.press(getByTestId("key-3"))
      fireEvent.press(getByTestId("key-4"))

      expect(mockOnPinComplete).toHaveBeenCalledWith("1234")
    })

    it("calls onPinChange when digit is pressed", () => {
      const { getByTestId } = render(
        <CardPinLayout {...defaultProps} onPinChange={mockOnPinChange} />,
      )

      fireEvent.press(getByTestId("key-1"))

      expect(mockOnPinChange).toHaveBeenCalled()
    })

    it("handles backspace key", () => {
      const { getByTestId } = render(
        <CardPinLayout {...defaultProps} onPinChange={mockOnPinChange} />,
      )

      fireEvent.press(getByTestId("key-1"))
      fireEvent.press(getByTestId("key-2"))
      fireEvent.press(getByTestId("key-backspace"))

      expect(mockOnPinChange).toHaveBeenCalled()
    })

    it("ignores decimal key", () => {
      const { getByTestId } = render(<CardPinLayout {...defaultProps} />)

      fireEvent.press(getByTestId("key-1"))
      fireEvent.press(getByTestId("key-decimal"))
      fireEvent.press(getByTestId("key-2"))
      fireEvent.press(getByTestId("key-3"))
      fireEvent.press(getByTestId("key-4"))

      expect(mockOnPinComplete).toHaveBeenCalledWith("1234")
    })

    it("does not exceed 4 digits", () => {
      const { getByTestId } = render(<CardPinLayout {...defaultProps} />)

      fireEvent.press(getByTestId("key-1"))
      fireEvent.press(getByTestId("key-2"))
      fireEvent.press(getByTestId("key-3"))
      fireEvent.press(getByTestId("key-4"))

      mockOnPinComplete.mockClear()

      fireEvent.press(getByTestId("key-5"))

      expect(mockOnPinComplete).not.toHaveBeenCalled()
    })
  })

  describe("confirm button interaction", () => {
    it("calls onConfirm when button is pressed", () => {
      const { getByText } = render(
        <CardPinLayout
          {...defaultProps}
          steps={["Set PIN", "Done"]}
          showConfirmButton={true}
          confirmButtonLabel="Submit PIN"
          onConfirm={mockOnConfirm}
        />,
      )

      fireEvent.press(getByText("Submit PIN"))

      expect(mockOnConfirm).toHaveBeenCalledTimes(1)
    })
  })

  describe("reset trigger", () => {
    it("resets PIN when resetTrigger changes", () => {
      const { getByTestId, rerender } = render(
        <CardPinLayout {...defaultProps} resetTrigger={0} />,
      )

      fireEvent.press(getByTestId("key-1"))
      fireEvent.press(getByTestId("key-2"))

      rerender(<CardPinLayout {...defaultProps} resetTrigger={1} />)

      fireEvent.press(getByTestId("key-1"))
      fireEvent.press(getByTestId("key-2"))
      fireEvent.press(getByTestId("key-3"))
      fireEvent.press(getByTestId("key-4"))

      expect(mockOnPinComplete).toHaveBeenCalledWith("1234")
    })
  })

  describe("three-step flow", () => {
    const threeStepProps = {
      ...defaultProps,
      steps: ["Current PIN", "New PIN", "Confirm"],
    }

    it("displays all three steps", () => {
      const { getByText } = render(<CardPinLayout {...threeStepProps} />)

      expect(getByText(/Current PIN/)).toBeTruthy()
      expect(getByText(/New PIN/)).toBeTruthy()
      expect(getByText(/Confirm/)).toBeTruthy()
    })

    it("shows step 1 as current initially", () => {
      const { getByText } = render(<CardPinLayout {...threeStepProps} />)

      expect(getByText("Current PIN (current)")).toBeTruthy()
    })

    it("shows step 2 as current when currentStep is 2", () => {
      const { getByText } = render(<CardPinLayout {...threeStepProps} currentStep={2} />)

      expect(getByText("New PIN (current)")).toBeTruthy()
    })

    it("shows step 3 as current when currentStep is 3", () => {
      const { getByText } = render(<CardPinLayout {...threeStepProps} currentStep={3} />)

      expect(getByText("Confirm (current)")).toBeTruthy()
    })
  })

  describe("rerender", () => {
    it("updates title when props change", () => {
      const { getByText, rerender } = render(<CardPinLayout {...defaultProps} />)

      expect(getByText("Enter your PIN")).toBeTruthy()

      rerender(<CardPinLayout {...defaultProps} title="New title" />)

      expect(getByText("New title")).toBeTruthy()
    })

    it("updates error message when props change", () => {
      const { getByText, queryByText, rerender } = render(
        <CardPinLayout {...defaultProps} />,
      )

      expect(queryByText("Error")).toBeNull()

      rerender(<CardPinLayout {...defaultProps} errorMessage="Error" />)

      expect(getByText("Error")).toBeTruthy()
    })

    it("shows confirm button when showConfirmButton changes to true", () => {
      const { queryByTestId, getByTestId, rerender } = render(
        <CardPinLayout {...defaultProps} />,
      )

      expect(queryByTestId("primary-button")).toBeNull()

      rerender(
        <CardPinLayout
          {...defaultProps}
          showConfirmButton={true}
          confirmButtonLabel="Confirm"
          onConfirm={mockOnConfirm}
        />,
      )

      expect(getByTestId("primary-button")).toBeTruthy()
    })
  })
})
