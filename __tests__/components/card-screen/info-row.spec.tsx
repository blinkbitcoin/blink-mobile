import React from "react"
import { StyleSheet, Text as RNText } from "react-native"
import { render } from "@testing-library/react-native"

import { InfoRow } from "@app/components/card-screen/info-row"

/** Real style fragments (not empty stubs) so a prop that fails to apply its style is
 *  actually caught by the assertions below, instead of passing against `{}`. */
jest.mock("@rn-vui/themed", () => ({
  Text: (props: React.ComponentProps<typeof RNText>) => <RNText {...props} />,
  useTheme: () => ({
    theme: {
      colors: {
        black: "#000000",
        grey2: "#666666",
        success: "#00C853",
        error: "#FF1744",
      },
    },
  }),
  makeStyles: () => () => ({
    container: { flexDirection: "row" },
    label: { fontWeight: "600" },
    regularLabel: { fontWeight: "400" },
    value: { fontWeight: "700" },
    mutedValue: { color: "#666666", fontWeight: "400" },
    secondaryValue: { fontWeight: "400" },
  }),
}))

describe("InfoRow", () => {
  const defaultProps = {
    label: "Test Label",
    value: "Test Value",
  }

  describe("rendering", () => {
    it("renders without crashing", () => {
      const { toJSON } = render(<InfoRow {...defaultProps} />)

      expect(toJSON()).toBeTruthy()
    })

    it("displays the label correctly", () => {
      const { getByText } = render(<InfoRow {...defaultProps} />)

      expect(getByText("Test Label")).toBeTruthy()
    })

    it("displays the value correctly", () => {
      const { getByText } = render(<InfoRow {...defaultProps} />)

      expect(getByText("Test Value")).toBeTruthy()
    })

    it("displays both label and value", () => {
      const { getByText } = render(<InfoRow label="Card Type" value="Virtual" />)

      expect(getByText("Card Type")).toBeTruthy()
      expect(getByText("Virtual")).toBeTruthy()
    })
  })

  describe("with custom value color", () => {
    it("paints the value with the given valueColor", () => {
      const { getByText } = render(<InfoRow {...defaultProps} valueColor="#00C853" />)

      const style = StyleSheet.flatten(getByText("Test Value").props.style)
      expect(style.color).toBe("#00C853")
    })

    it("uses success color for an active status", () => {
      const { getByText } = render(
        <InfoRow label="Status" value="Active" valueColor="#00C853" />,
      )

      expect(StyleSheet.flatten(getByText("Active").props.style).color).toBe("#00C853")
    })

    it("uses error color for an inactive status", () => {
      const { getByText } = render(
        <InfoRow label="Status" value="Frozen" valueColor="#FF1744" />,
      )

      expect(StyleSheet.flatten(getByText("Frozen").props.style).color).toBe("#FF1744")
    })
  })

  describe("different content types", () => {
    it("renders with date format", () => {
      const { getByText } = render(<InfoRow label="Issued" value="Jan 15, 2024" />)

      expect(getByText("Issued")).toBeTruthy()
      expect(getByText("Jan 15, 2024")).toBeTruthy()
    })

    it("renders with network name", () => {
      const { getByText } = render(<InfoRow label="Network" value="Mastercard" />)

      expect(getByText("Network")).toBeTruthy()
      expect(getByText("Mastercard")).toBeTruthy()
    })

    it("renders with card type", () => {
      const { getByText } = render(<InfoRow label="Card Type" value="Virtual prepaid" />)

      expect(getByText("Card Type")).toBeTruthy()
      expect(getByText("Virtual prepaid")).toBeTruthy()
    })

    it("renders with empty value", () => {
      const { getByText } = render(<InfoRow label="Empty Field" value="" />)

      expect(getByText("Empty Field")).toBeTruthy()
    })

    it("renders with long value", () => {
      const longValue = "This is a very long value that might need to wrap"
      const { getByText } = render(<InfoRow label="Long" value={longValue} />)

      expect(getByText(longValue)).toBeTruthy()
    })
  })

  describe("without valueColor", () => {
    it("falls back to the theme's default color", () => {
      const { getByText } = render(<InfoRow {...defaultProps} />)

      expect(StyleSheet.flatten(getByText("Test Value").props.style).color).toBe(
        "#000000",
      )
    })
  })

  describe("with isValueMuted", () => {
    it("applies the muted value style and ignores valueColor", () => {
      const { getByText } = render(
        <InfoRow
          label="New Dollar Balance"
          value="not available"
          valueColor="#00C853"
          isValueMuted
        />,
      )

      const style = StyleSheet.flatten(getByText("not available").props.style)
      expect(style.color).toBe("#666666")
      expect(style.fontWeight).toBe("400")
    })

    it("keeps the bold value style when not muted", () => {
      const { getByText } = render(<InfoRow {...defaultProps} />)

      expect(StyleSheet.flatten(getByText("Test Value").props.style).fontWeight).toBe(
        "700",
      )
    })
  })

  describe("with isLabelRegular", () => {
    it("renders the label at regular weight", () => {
      const { getByText } = render(
        <InfoRow label="Current Bitcoin Balance" value="21,493 SAT" isLabelRegular />,
      )

      expect(
        StyleSheet.flatten(getByText("Current Bitcoin Balance").props.style).fontWeight,
      ).toBe("400")
    })

    it("keeps the label bold by default", () => {
      const { getByText } = render(<InfoRow {...defaultProps} />)

      expect(StyleSheet.flatten(getByText("Test Label").props.style).fontWeight).toBe(
        "600",
      )
    })
  })

  describe("with secondaryValue", () => {
    it("renders the value together with its secondary part", () => {
      const { getByText } = render(
        <InfoRow
          label="Current Bitcoin Balance"
          value="21,493 SAT"
          secondaryValue=" ($22.42)"
        />,
      )

      expect(getByText("21,493 SAT ($22.42)")).toBeTruthy()
    })
  })
})
