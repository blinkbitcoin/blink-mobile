import React from "react"
import { TextStyle } from "react-native"
import { render, fireEvent } from "@testing-library/react-native"
import { ThemeProvider } from "@rn-vui/themed"

import { SettingItemRow } from "@app/components/card-screen"
import theme from "@app/rne-theme/theme"

const dangerTitleStyle: TextStyle = { color: "#DC2626" }
const smallFontStyle: TextStyle = { fontSize: 12 }

const renderWithTheme = (component: React.ReactElement) => {
  return render(<ThemeProvider theme={theme}>{component}</ThemeProvider>)
}

describe("SettingItemRow", () => {
  const mockOnPress = jest.fn()

  const defaultProps = {
    title: "Personal Details",
    onPress: mockOnPress,
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("rendering", () => {
    it("renders without crashing", () => {
      const { toJSON } = renderWithTheme(<SettingItemRow {...defaultProps} />)
      expect(toJSON()).toBeTruthy()
    })

    it("displays title correctly", () => {
      const { getByText } = renderWithTheme(<SettingItemRow {...defaultProps} />)
      expect(getByText("Personal Details")).toBeTruthy()
    })

    it("displays subtitle when provided", () => {
      const { getByText } = renderWithTheme(
        <SettingItemRow {...defaultProps} subtitle="Update your personal information" />,
      )
      expect(getByText("Update your personal information")).toBeTruthy()
    })

    it("does not display subtitle when not provided", () => {
      const { queryByText } = renderWithTheme(<SettingItemRow {...defaultProps} />)
      expect(queryByText("Update your personal information")).toBeNull()
    })

    it("renders without onPress as non-pressable", () => {
      const { toJSON } = renderWithTheme(<SettingItemRow title="Static Row" />)
      expect(toJSON()).toBeTruthy()
    })
  })

  describe("with left icon", () => {
    it("renders with leftIcon prop", () => {
      const { toJSON } = renderWithTheme(
        <SettingItemRow {...defaultProps} leftIcon="user" />,
      )
      expect(toJSON()).toBeTruthy()
    })

    it("renders with leftIonicon prop", () => {
      const { toJSON } = renderWithTheme(
        <SettingItemRow {...defaultProps} leftIonicon="wallet-outline" />,
      )
      expect(toJSON()).toBeTruthy()
    })

    it("renders without left icon", () => {
      const { toJSON } = renderWithTheme(<SettingItemRow {...defaultProps} />)
      expect(toJSON()).toBeTruthy()
    })
  })

  describe("with right icon", () => {
    it("renders with default right icon", () => {
      const { toJSON } = renderWithTheme(<SettingItemRow {...defaultProps} />)
      expect(toJSON()).toBeTruthy()
    })

    it("renders without right icon when set to null", () => {
      const { toJSON } = renderWithTheme(
        <SettingItemRow {...defaultProps} rightIcon={null} />,
      )
      expect(toJSON()).toBeTruthy()
    })

    it("renders with custom right icon", () => {
      const { toJSON } = renderWithTheme(
        <SettingItemRow {...defaultProps} rightIcon="info" />,
      )
      expect(toJSON()).toBeTruthy()
    })
  })

  describe("with subtitle (card style)", () => {
    it("renders with subtitle and title", () => {
      const { getByText } = renderWithTheme(
        <SettingItemRow
          title="Contact Support"
          subtitle="support@example.com"
          onPress={mockOnPress}
        />,
      )
      expect(getByText("Contact Support")).toBeTruthy()
      expect(getByText("support@example.com")).toBeTruthy()
    })

    it("renders with custom title and subtitle styles", () => {
      const { getByText } = renderWithTheme(
        <SettingItemRow
          title="Close Account"
          subtitle="This action cannot be undone"
          titleStyle={dangerTitleStyle}
          subtitleStyle={smallFontStyle}
          onPress={mockOnPress}
        />,
      )
      expect(getByText("Close Account")).toBeTruthy()
      expect(getByText("This action cannot be undone")).toBeTruthy()
    })
  })

  describe("interaction", () => {
    it("calls onPress when pressed", () => {
      const { getByRole } = renderWithTheme(<SettingItemRow {...defaultProps} />)

      const button = getByRole("button")
      fireEvent.press(button)

      expect(mockOnPress).toHaveBeenCalledTimes(1)
    })

    it("calls onPress multiple times when pressed multiple times", () => {
      const { getByRole } = renderWithTheme(<SettingItemRow {...defaultProps} />)

      const button = getByRole("button")
      fireEvent.press(button)
      fireEvent.press(button)
      fireEvent.press(button)

      expect(mockOnPress).toHaveBeenCalledTimes(3)
    })

    it("handles pressIn event", () => {
      const { getByRole } = renderWithTheme(<SettingItemRow {...defaultProps} />)

      const button = getByRole("button")
      fireEvent(button, "pressIn")

      expect(mockOnPress).not.toHaveBeenCalled()
    })

    it("handles pressOut event", () => {
      const { getByRole } = renderWithTheme(<SettingItemRow {...defaultProps} />)

      const button = getByRole("button")
      fireEvent(button, "pressOut")

      expect(mockOnPress).not.toHaveBeenCalled()
    })
  })

  describe("accessibility", () => {
    it("has correct accessibility role", () => {
      const { getByRole } = renderWithTheme(<SettingItemRow {...defaultProps} />)
      expect(getByRole("button")).toBeTruthy()
    })

    it("has correct accessibility label without subtitle", () => {
      const { getByLabelText } = renderWithTheme(<SettingItemRow {...defaultProps} />)
      expect(getByLabelText("Personal Details")).toBeTruthy()
    })

    it("has correct accessibility label with subtitle", () => {
      const { getByLabelText } = renderWithTheme(
        <SettingItemRow
          title="Contact Support"
          subtitle="support@example.com"
          onPress={mockOnPress}
        />,
      )
      expect(getByLabelText("Contact Support, support@example.com")).toBeTruthy()
    })
  })

  describe("different content variations", () => {
    it("renders account information row", () => {
      const { getByText } = renderWithTheme(
        <SettingItemRow title="Personal Details" leftIcon="user" onPress={mockOnPress} />,
      )
      expect(getByText("Personal Details")).toBeTruthy()
    })

    it("renders card management row", () => {
      const { getByText } = renderWithTheme(
        <SettingItemRow
          title="Order Physical Card"
          leftIcon="physical-card"
          onPress={mockOnPress}
        />,
      )
      expect(getByText("Order Physical Card")).toBeTruthy()
    })

    it("renders danger zone row with custom styles", () => {
      const { getByText } = renderWithTheme(
        <SettingItemRow
          title="Close Card Account"
          subtitle="Permanently close your card"
          leftIcon="trash"
          titleStyle={dangerTitleStyle}
          onPress={mockOnPress}
        />,
      )
      expect(getByText("Close Card Account")).toBeTruthy()
      expect(getByText("Permanently close your card")).toBeTruthy()
    })
  })
})
