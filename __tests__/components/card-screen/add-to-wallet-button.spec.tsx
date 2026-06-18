import React from "react"
import { Text as RNText, View } from "react-native"
import { render, fireEvent } from "@testing-library/react-native"

import { AddToWalletButton } from "@app/components/card-screen/add-to-wallet-button"

jest.mock("@rn-vui/themed", () => ({
  Text: (props: React.ComponentProps<typeof RNText>) => <RNText {...props} />,
  useTheme: () => ({
    theme: {
      colors: {
        _white: "#FFFFFF",
        _darkGrey: "#1d1d1d",
      },
    },
  }),
  makeStyles: () => () => ({
    button: {},
    buttonDisabled: { opacity: 0.5 },
    buttonPressed: { opacity: 0.7 },
    buttonText: {},
  }),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      CardFlow: {
        AddToMobileWallet: {
          addTo: () => "Add to",
        },
      },
    },
  }),
}))

let mockIsIos = false
jest.mock("@app/utils/helper", () => ({
  get isIos() {
    return mockIsIos
  },
}))

jest.mock("@app/components/atomic/galoy-icon", () => ({
  GaloyIcon: ({
    name,
    color,
    width,
    height,
  }: {
    name: string
    color: string
    width: number
    height: number
  }) => (
    <View testID={`galoy-icon-${name}`} accessibilityHint={`${color}-${width}-${height}`}>
      <RNText>{name}</RNText>
    </View>
  ),
}))

describe("AddToWalletButton", () => {
  const mockOnPress = jest.fn()

  const defaultProps = {
    onPress: mockOnPress,
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockIsIos = false
  })

  describe("rendering", () => {
    it("renders without crashing", () => {
      const { toJSON } = render(<AddToWalletButton {...defaultProps} />)

      expect(toJSON()).toBeTruthy()
    })

    it("displays add to text", () => {
      const { getByText } = render(<AddToWalletButton {...defaultProps} />)

      expect(getByText("Add to")).toBeTruthy()
    })

    it("renders google pay icon on android", () => {
      mockIsIos = false
      const { getByTestId } = render(<AddToWalletButton {...defaultProps} />)

      expect(getByTestId("galoy-icon-google-pay")).toBeTruthy()
    })

    it("renders apple pay icon on ios", () => {
      mockIsIos = true
      const { getByTestId } = render(<AddToWalletButton {...defaultProps} />)

      expect(getByTestId("galoy-icon-apple-pay")).toBeTruthy()
    })
  })

  describe("icon sizing", () => {
    it("uses correct dimensions for google pay icon", () => {
      mockIsIos = false
      const { getByTestId } = render(<AddToWalletButton {...defaultProps} />)

      const icon = getByTestId("galoy-icon-google-pay")
      expect(icon.props.accessibilityHint).toContain("62")
      expect(icon.props.accessibilityHint).toContain("24")
    })

    it("uses correct dimensions for apple pay icon", () => {
      mockIsIos = true
      const { getByTestId } = render(<AddToWalletButton {...defaultProps} />)

      const icon = getByTestId("galoy-icon-apple-pay")
      expect(icon.props.accessibilityHint).toContain("55")
      expect(icon.props.accessibilityHint).toContain("22")
    })
  })

  describe("interactions", () => {
    it("calls onPress when pressed", () => {
      const { getByRole } = render(<AddToWalletButton {...defaultProps} />)

      fireEvent.press(getByRole("button"))

      expect(mockOnPress).toHaveBeenCalledTimes(1)
    })

    it("calls onPress multiple times when pressed multiple times", () => {
      const { getByRole } = render(<AddToWalletButton {...defaultProps} />)

      const button = getByRole("button")
      fireEvent.press(button)
      fireEvent.press(button)
      fireEvent.press(button)

      expect(mockOnPress).toHaveBeenCalledTimes(3)
    })

    it("does not call onPress when disabled", () => {
      const { getByRole } = render(
        <AddToWalletButton {...defaultProps} disabled={true} />,
      )

      fireEvent.press(getByRole("button"))

      expect(mockOnPress).not.toHaveBeenCalled()
    })
  })

  describe("disabled state", () => {
    it("renders in disabled state", () => {
      const { getByRole } = render(
        <AddToWalletButton {...defaultProps} disabled={true} />,
      )

      const button = getByRole("button")
      expect(button.props.accessibilityState.disabled).toBe(true)
    })

    it("renders in enabled state by default", () => {
      const { getByRole } = render(<AddToWalletButton {...defaultProps} />)

      const button = getByRole("button")
      expect(button.props.accessibilityState.disabled).toBe(false)
    })

    it("does not respond to press when disabled", () => {
      const { getByRole } = render(
        <AddToWalletButton {...defaultProps} disabled={true} />,
      )

      const button = getByRole("button")
      fireEvent.press(button)

      expect(mockOnPress).not.toHaveBeenCalled()
    })
  })

  describe("accessibility", () => {
    it("has button role", () => {
      const { getByRole } = render(<AddToWalletButton {...defaultProps} />)

      expect(getByRole("button")).toBeTruthy()
    })

    it("has correct accessibility label for android", () => {
      mockIsIos = false
      const { getByLabelText } = render(<AddToWalletButton {...defaultProps} />)

      expect(getByLabelText("Add to Google Pay")).toBeTruthy()
    })

    it("has correct accessibility label for ios", () => {
      mockIsIos = true
      const { getByLabelText } = render(<AddToWalletButton {...defaultProps} />)

      expect(getByLabelText("Add to Apple Wallet")).toBeTruthy()
    })
  })

  describe("callback references", () => {
    it("calls updated callback when reference changes", () => {
      const firstOnPress = jest.fn()
      const secondOnPress = jest.fn()

      const { getByRole, rerender } = render(<AddToWalletButton onPress={firstOnPress} />)

      fireEvent.press(getByRole("button"))
      expect(firstOnPress).toHaveBeenCalledTimes(1)

      rerender(<AddToWalletButton onPress={secondOnPress} />)

      fireEvent.press(getByRole("button"))
      expect(secondOnPress).toHaveBeenCalledTimes(1)
      expect(firstOnPress).toHaveBeenCalledTimes(1)
    })
  })

  describe("rerender", () => {
    it("updates disabled state on rerender", () => {
      const { getByRole, rerender } = render(<AddToWalletButton {...defaultProps} />)

      expect(getByRole("button").props.accessibilityState.disabled).toBe(false)

      rerender(<AddToWalletButton {...defaultProps} disabled={true} />)

      expect(getByRole("button").props.accessibilityState.disabled).toBe(true)
    })

    it("enables button on rerender", () => {
      const { getByRole, rerender } = render(
        <AddToWalletButton {...defaultProps} disabled={true} />,
      )

      expect(getByRole("button").props.accessibilityState.disabled).toBe(true)

      rerender(<AddToWalletButton {...defaultProps} disabled={false} />)

      expect(getByRole("button").props.accessibilityState.disabled).toBe(false)
    })
  })

  describe("platform switching", () => {
    it("shows correct icon when platform changes", () => {
      mockIsIos = false
      const { getByTestId, queryByTestId, rerender } = render(
        <AddToWalletButton {...defaultProps} />,
      )

      expect(getByTestId("galoy-icon-google-pay")).toBeTruthy()
      expect(queryByTestId("galoy-icon-apple-pay")).toBeNull()

      mockIsIos = true
      rerender(<AddToWalletButton {...defaultProps} />)

      expect(getByTestId("galoy-icon-apple-pay")).toBeTruthy()
      expect(queryByTestId("galoy-icon-google-pay")).toBeNull()
    })
  })
})
