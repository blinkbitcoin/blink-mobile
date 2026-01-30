import React from "react"
import { render, fireEvent } from "@testing-library/react-native"
import { ThemeProvider } from "@rn-vui/themed"

import { ContactSupportRow } from "@app/components/card-screen"
import TypesafeI18n from "@app/i18n/i18n-react"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import theme from "@app/rne-theme/theme"

jest.mock("@app/config/feature-flags-context", () => ({
  useRemoteConfig: () => ({
    feedbackEmailAddress: "support@blink.sv",
  }),
}))

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      <TypesafeI18n locale="en">{component}</TypesafeI18n>
    </ThemeProvider>,
  )
}

describe("ContactSupportRow", () => {
  const mockOnPress = jest.fn()

  beforeEach(() => {
    loadLocale("en")
    jest.clearAllMocks()
  })

  describe("rendering", () => {
    it("renders without crashing", () => {
      const { toJSON } = renderWithProviders(<ContactSupportRow onPress={mockOnPress} />)
      expect(toJSON()).toBeTruthy()
    })

    it("displays contact support title", () => {
      const { getByText } = renderWithProviders(
        <ContactSupportRow onPress={mockOnPress} />,
      )
      expect(getByText("Contact Support")).toBeTruthy()
    })

    it("displays the feedback email address as subtitle", () => {
      const { getByText } = renderWithProviders(
        <ContactSupportRow onPress={mockOnPress} />,
      )
      expect(getByText("support@blink.sv")).toBeTruthy()
    })

    it("renders with custom right icon color", () => {
      const { toJSON } = renderWithProviders(
        <ContactSupportRow onPress={mockOnPress} rightIconColor="#FF0000" />,
      )
      expect(toJSON()).toBeTruthy()
    })
  })

  describe("interaction", () => {
    it("calls onPress when pressed", () => {
      const { getByRole } = renderWithProviders(
        <ContactSupportRow onPress={mockOnPress} />,
      )

      const button = getByRole("button")
      fireEvent.press(button)

      expect(mockOnPress).toHaveBeenCalledTimes(1)
    })

    it("calls onPress multiple times when pressed multiple times", () => {
      const { getByRole } = renderWithProviders(
        <ContactSupportRow onPress={mockOnPress} />,
      )

      const button = getByRole("button")
      fireEvent.press(button)
      fireEvent.press(button)
      fireEvent.press(button)

      expect(mockOnPress).toHaveBeenCalledTimes(3)
    })
  })

  describe("accessibility", () => {
    it("has correct accessibility role", () => {
      const { getByRole } = renderWithProviders(
        <ContactSupportRow onPress={mockOnPress} />,
      )
      expect(getByRole("button")).toBeTruthy()
    })

    it("has correct accessibility label with title and subtitle", () => {
      const { getByLabelText } = renderWithProviders(
        <ContactSupportRow onPress={mockOnPress} />,
      )
      expect(getByLabelText("Contact Support, support@blink.sv")).toBeTruthy()
    })
  })
})
