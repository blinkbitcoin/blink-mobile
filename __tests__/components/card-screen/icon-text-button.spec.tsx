import React from "react"
import { Text as RNText, View } from "react-native"
import { render, fireEvent } from "@testing-library/react-native"

import { IconTextButton } from "@app/components/card-screen/icon-text-button"

jest.mock("@rn-vui/themed", () => ({
  Text: (props: React.ComponentProps<typeof RNText>) => <RNText {...props} />,
  useTheme: () => ({
    theme: {
      colors: {
        primary: "#F7931A",
        error: "#FF0000",
        grey5: "#F5F5F5",
      },
    },
  }),
  makeStyles: () => (_props: { textColor: string }) => ({
    container: {},
    label: {},
  }),
}))

jest.mock("@app/components/atomic/galoy-icon", () => ({
  GaloyIcon: ({ name, color }: { name: string; size: number; color: string }) => (
    <View testID={`galoy-icon-${name}`}>
      <RNText>{name}</RNText>
      <RNText testID={`galoy-icon-${name}-color`}>{color}</RNText>
    </View>
  ),
}))

describe("IconTextButton", () => {
  const mockOnPress = jest.fn()

  const defaultProps = {
    icon: "map" as const,
    label: "View on map",
    onPress: mockOnPress,
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("rendering", () => {
    it("renders without crashing", () => {
      const { toJSON } = render(<IconTextButton {...defaultProps} />)

      expect(toJSON()).toBeTruthy()
    })

    it("displays the label text", () => {
      const { getByText } = render(<IconTextButton {...defaultProps} />)

      expect(getByText("View on map")).toBeTruthy()
    })

    it("renders the icon", () => {
      const { getByTestId } = render(<IconTextButton {...defaultProps} />)

      expect(getByTestId("galoy-icon-map")).toBeTruthy()
    })

    it("renders with different icon", () => {
      const { getByTestId } = render(<IconTextButton {...defaultProps} icon="download" />)

      expect(getByTestId("galoy-icon-download")).toBeTruthy()
    })

    it("renders with different label", () => {
      const { getByText } = render(
        <IconTextButton {...defaultProps} label="Download receipt" />,
      )

      expect(getByText("Download receipt")).toBeTruthy()
    })
  })

  describe("interactions", () => {
    it("calls onPress when pressed", () => {
      const { getByText } = render(<IconTextButton {...defaultProps} />)

      fireEvent.press(getByText("View on map"))

      expect(mockOnPress).toHaveBeenCalledTimes(1)
    })

    it("calls onPress multiple times when pressed multiple times", () => {
      const { getByText } = render(<IconTextButton {...defaultProps} />)

      const button = getByText("View on map")
      fireEvent.press(button)
      fireEvent.press(button)
      fireEvent.press(button)

      expect(mockOnPress).toHaveBeenCalledTimes(3)
    })

    it("calls updated callback when reference changes", () => {
      const firstOnPress = jest.fn()
      const secondOnPress = jest.fn()

      const { getByText, rerender } = render(
        <IconTextButton {...defaultProps} onPress={firstOnPress} />,
      )

      fireEvent.press(getByText("View on map"))
      expect(firstOnPress).toHaveBeenCalledTimes(1)

      rerender(<IconTextButton {...defaultProps} onPress={secondOnPress} />)

      fireEvent.press(getByText("View on map"))
      expect(secondOnPress).toHaveBeenCalledTimes(1)
      expect(firstOnPress).toHaveBeenCalledTimes(1)
    })
  })

  describe("custom colors", () => {
    it("renders with custom icon color", () => {
      const { getByTestId } = render(
        <IconTextButton {...defaultProps} iconColor="#FF0000" />,
      )

      expect(getByTestId("galoy-icon-map-color").props.children).toBe("#FF0000")
    })

    it("renders with custom text color", () => {
      const { getByText } = render(
        <IconTextButton {...defaultProps} textColor="#FF0000" />,
      )

      expect(getByText("View on map")).toBeTruthy()
    })

    it("renders with both custom icon and text colors", () => {
      const { getByText, getByTestId } = render(
        <IconTextButton {...defaultProps} iconColor="#FF0000" textColor="#FF0000" />,
      )

      expect(getByText("View on map")).toBeTruthy()
      expect(getByTestId("galoy-icon-map-color").props.children).toBe("#FF0000")
    })

    it("uses default colors when not provided", () => {
      const { getByTestId } = render(<IconTextButton {...defaultProps} />)

      expect(getByTestId("galoy-icon-map-color").props.children).toBe("#F7931A")
    })
  })

  describe("accessibility", () => {
    it("has correct accessibility role", () => {
      const { getByRole } = render(<IconTextButton {...defaultProps} />)

      expect(getByRole("button")).toBeTruthy()
    })

    it("has correct accessibility label", () => {
      const { getByLabelText } = render(<IconTextButton {...defaultProps} />)

      expect(getByLabelText("View on map")).toBeTruthy()
    })
  })

  describe("report issue button", () => {
    it("renders report issue button with error color", () => {
      const { getByText, getByTestId } = render(
        <IconTextButton
          icon="report-flag"
          label="Report issue"
          onPress={mockOnPress}
          iconColor="#FF0000"
          textColor="#FF0000"
        />,
      )

      expect(getByText("Report issue")).toBeTruthy()
      expect(getByTestId("galoy-icon-report-flag")).toBeTruthy()
    })
  })
})
