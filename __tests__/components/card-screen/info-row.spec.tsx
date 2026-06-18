import React from "react"
import { Text as RNText } from "react-native"
import { render } from "@testing-library/react-native"

import { InfoRow } from "@app/components/card-screen/info-row"

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
    container: {},
    label: {},
    value: {},
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
    it("renders with custom valueColor", () => {
      const { getByText } = render(<InfoRow {...defaultProps} valueColor="#00C853" />)

      const valueElement = getByText("Test Value")
      expect(valueElement).toBeTruthy()
    })

    it("renders with success color for active status", () => {
      const { getByText } = render(
        <InfoRow label="Status" value="Active" valueColor="#00C853" />,
      )

      expect(getByText("Active")).toBeTruthy()
    })

    it("renders with error color for inactive status", () => {
      const { getByText } = render(
        <InfoRow label="Status" value="Frozen" valueColor="#FF1744" />,
      )

      expect(getByText("Frozen")).toBeTruthy()
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
    it("uses default color when valueColor is not provided", () => {
      const { getByText } = render(<InfoRow {...defaultProps} />)

      const valueElement = getByText("Test Value")
      expect(valueElement).toBeTruthy()
    })
  })
})
