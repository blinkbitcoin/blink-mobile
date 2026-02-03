import React from "react"
import { Text as RNText } from "react-native"
import { render } from "@testing-library/react-native"

import { InputField } from "@app/components/card-screen/input-field"

jest.mock("@rn-vui/themed", () => ({
  Text: (props: React.ComponentProps<typeof RNText>) => <RNText {...props} />,
  makeStyles: () => () => ({
    container: {},
    label: {},
    valueContainer: {},
    value: {},
  }),
  useTheme: () => ({
    theme: {
      colors: {
        primary: "#000",
      },
    },
  }),
  Icon: () => null,
}))

describe("InputField", () => {
  const defaultProps = {
    label: "First name",
    value: "Satoshi",
  }

  describe("rendering", () => {
    it("renders without crashing", () => {
      const { toJSON } = render(<InputField {...defaultProps} />)

      expect(toJSON()).toBeTruthy()
    })

    it("displays the label", () => {
      const { getByText } = render(<InputField {...defaultProps} />)

      expect(getByText("First name")).toBeTruthy()
    })

    it("displays the value", () => {
      const { getByText } = render(<InputField {...defaultProps} />)

      expect(getByText("Satoshi")).toBeTruthy()
    })

    it("displays both label and value together", () => {
      const { getByText } = render(<InputField {...defaultProps} />)

      expect(getByText("First name")).toBeTruthy()
      expect(getByText("Satoshi")).toBeTruthy()
    })
  })

  describe("different content", () => {
    it("renders with last name content", () => {
      const { getByText } = render(<InputField label="Last name" value="Nakamoto" />)

      expect(getByText("Last name")).toBeTruthy()
      expect(getByText("Nakamoto")).toBeTruthy()
    })

    it("renders with date of birth content", () => {
      const { getByText } = render(
        <InputField label="Date of birth" value="1971-01-03" />,
      )

      expect(getByText("Date of birth")).toBeTruthy()
      expect(getByText("1971-01-03")).toBeTruthy()
    })

    it("renders with email content", () => {
      const { getByText } = render(
        <InputField label="Email address" value="satoshi@bitcoin.org" />,
      )

      expect(getByText("Email address")).toBeTruthy()
      expect(getByText("satoshi@bitcoin.org")).toBeTruthy()
    })

    it("renders with phone content", () => {
      const { getByText } = render(
        <InputField label="Phone number" value="+1 (555) 123-4567" />,
      )

      expect(getByText("Phone number")).toBeTruthy()
      expect(getByText("+1 (555) 123-4567")).toBeTruthy()
    })
  })

  describe("edge cases", () => {
    it("renders with empty value", () => {
      const { getByText } = render(<InputField label="First name" value="" />)

      expect(getByText("First name")).toBeTruthy()
    })

    it("renders with long value", () => {
      const longValue = "This is a very long value that should still render correctly"
      const { getByText } = render(<InputField label="Description" value={longValue} />)

      expect(getByText(longValue)).toBeTruthy()
    })

    it("renders with special characters in value", () => {
      const { getByText } = render(<InputField label="Name" value="José García-López" />)

      expect(getByText("José García-López")).toBeTruthy()
    })

    it("renders with numbers in value", () => {
      const { getByText } = render(<InputField label="ID" value="123456789" />)

      expect(getByText("123456789")).toBeTruthy()
    })
  })

  describe("rerender", () => {
    it("updates label when prop changes", () => {
      const { getByText, queryByText, rerender } = render(
        <InputField {...defaultProps} />,
      )

      expect(getByText("First name")).toBeTruthy()

      rerender(<InputField label="Last name" value="Satoshi" />)

      expect(getByText("Last name")).toBeTruthy()
      expect(queryByText("First name")).toBeNull()
    })

    it("updates value when prop changes", () => {
      const { getByText, queryByText, rerender } = render(
        <InputField {...defaultProps} />,
      )

      expect(getByText("Satoshi")).toBeTruthy()

      rerender(<InputField label="First name" value="Nakamoto" />)

      expect(getByText("Nakamoto")).toBeTruthy()
      expect(queryByText("Satoshi")).toBeNull()
    })

    it("updates both label and value when props change", () => {
      const { getByText, rerender } = render(<InputField {...defaultProps} />)

      expect(getByText("First name")).toBeTruthy()
      expect(getByText("Satoshi")).toBeTruthy()

      rerender(<InputField label="Email" value="test@example.com" />)

      expect(getByText("Email")).toBeTruthy()
      expect(getByText("test@example.com")).toBeTruthy()
    })
  })
})
