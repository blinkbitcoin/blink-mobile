import React from "react"
import { Text as RNText, TextInput as RNTextInput, View } from "react-native"
import { render, fireEvent } from "@testing-library/react-native"

import { ShippingAddressForm } from "@app/components/card-screen/shipping-address-form"
import { ShippingAddress } from "@app/screens/card-screen/types"

jest.mock("@rn-vui/themed", () => ({
  Text: (props: React.ComponentProps<typeof RNText>) => <RNText {...props} />,
  useTheme: () => ({
    theme: {
      colors: {
        black: "#000000",
        grey2: "#666666",
        grey3: "#CCCCCC",
        grey5: "#F5F5F5",
        primary: "#3B82F6",
      },
    },
  }),
  makeStyles: () => () => ({
    container: {},
    gridRow: {},
    gridItem: {},
  }),
}))

const mockNavigate = jest.fn()
const mockGoBack = jest.fn()

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: mockGoBack,
  }),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      CardFlow: {
        ShippingAddress: {
          firstName: () => "First name",
          lastName: () => "Last name",
          addressLine1: () => "Address line 1",
          addressLine2: () => "Address line 2",
          city: () => "City",
          state: () => "State",
          region: () => "Region",
          postalCode: () => "Postal code",
          country: () => "Country",
          noPOBoxes: () => "P.O. Boxes are not allowed",
        },
      },
      common: {
        validation: {
          required: () => "Required",
          minChars: ({ min }: { min: number }) => `Min ${min} chars`,
          invalidPostalCode: () => "Invalid postal code",
        },
      },
    },
  }),
}))

jest.mock("postcode-validator", () => ({
  postcodeValidator: (value: string, country: string) => {
    if (country === "US") return /^\d{5}(-\d{4})?$/.test(value)
    if (country === "CA") return /^[A-Z]\d[A-Z] ?\d[A-Z]\d$/i.test(value)
    return true
  },
  postcodeValidatorExistsForCountry: (country: string) => ["US", "CA"].includes(country),
}))

jest.mock("@app/utils/country-region-data", () => ({
  getAllCountries: () => [
    { value: "US", label: "United States" },
    { value: "CA", label: "Canada" },
  ],
  getRegionsByCountry: (code: string) => {
    if (code === "US")
      return [
        { value: "NY", label: "New York" },
        { value: "CA", label: "California" },
      ]
    if (code === "CA")
      return [
        { value: "ON", label: "Ontario" },
        { value: "BC", label: "British Columbia" },
      ]
    return []
  },
  getCountryLabel: (code: string) => {
    const labels: Record<string, string> = { US: "United States", CA: "Canada" }
    return labels[code] ?? code
  },
}))

jest.mock("@app/components/card-screen/input-field", () => ({
  InputField: ({
    label,
    value,
    onPress,
    onChangeText,
    errorMessage,
  }: {
    label: string
    value: string
    onPress?: () => void
    onChangeText?: (text: string) => void
    errorMessage?: string
  }) => (
    <View testID={`input-field-${label}`} accessibilityHint={value}>
      <RNText>{label}</RNText>
      {onChangeText ? (
        <RNTextInput
          testID={`text-input-${label}`}
          value={value}
          onChangeText={onChangeText}
        />
      ) : (
        <RNText>{value}</RNText>
      )}
      {onPress && (
        <View testID={`press-${label}`} onTouchEnd={onPress}>
          <RNText>press</RNText>
        </View>
      )}
      {errorMessage !== undefined && (
        <RNText testID={`error-${label}`}>{errorMessage}</RNText>
      )}
    </View>
  ),
  ValueStyle: {
    Bold: "bold",
    Regular: "regular",
  },
}))

describe("ShippingAddressForm", () => {
  const mockAddress: ShippingAddress = {
    firstName: "Satoshi",
    lastName: "Nakamoto",
    line1: "123 Main Street",
    line2: "Apt 4B",
    city: "New York",
    region: "NY",
    postalCode: "10001",
    countryCode: "US",
  }

  const defaultProps = {
    address: mockAddress,
    onAddressChange: jest.fn(),
  }

  beforeEach(jest.clearAllMocks)

  describe("rendering", () => {
    it("renders without crashing", () => {
      const { toJSON } = render(<ShippingAddressForm {...defaultProps} />)

      expect(toJSON()).toBeTruthy()
    })

    it("displays all field labels", () => {
      const { getByText } = render(<ShippingAddressForm {...defaultProps} />)

      expect(getByText("First name")).toBeTruthy()
      expect(getByText("Last name")).toBeTruthy()
      expect(getByText("Address line 1")).toBeTruthy()
      expect(getByText("Address line 2")).toBeTruthy()
      expect(getByText("City")).toBeTruthy()
      expect(getByText("State")).toBeTruthy()
      expect(getByText("Postal code")).toBeTruthy()
      expect(getByText("Country")).toBeTruthy()
    })
  })

  describe("showFullName", () => {
    it("shows name fields by default", () => {
      const { getByTestId } = render(<ShippingAddressForm {...defaultProps} />)

      expect(getByTestId("input-field-First name")).toBeTruthy()
      expect(getByTestId("input-field-Last name")).toBeTruthy()
    })

    it("shows name fields when showFullName is true", () => {
      const { getByTestId } = render(
        <ShippingAddressForm {...defaultProps} showFullName={true} />,
      )

      expect(getByTestId("input-field-First name")).toBeTruthy()
      expect(getByTestId("input-field-Last name")).toBeTruthy()
    })

    it("hides name fields when showFullName is false", () => {
      const { queryByTestId } = render(
        <ShippingAddressForm {...defaultProps} showFullName={false} />,
      )

      expect(queryByTestId("input-field-First name")).toBeNull()
      expect(queryByTestId("input-field-Last name")).toBeNull()
    })
  })

  describe("inline editing", () => {
    it("calls onAddressChange when first name changes", () => {
      const { getByTestId } = render(<ShippingAddressForm {...defaultProps} />)

      fireEvent.changeText(getByTestId("text-input-First name"), "Hal")

      expect(defaultProps.onAddressChange).toHaveBeenCalledWith({
        ...mockAddress,
        firstName: "Hal",
      })
    })

    it("calls onAddressChange when last name changes", () => {
      const { getByTestId } = render(<ShippingAddressForm {...defaultProps} />)

      fireEvent.changeText(getByTestId("text-input-Last name"), "Finney")

      expect(defaultProps.onAddressChange).toHaveBeenCalledWith({
        ...mockAddress,
        lastName: "Finney",
      })
    })

    it("calls onAddressChange when address line 1 changes", () => {
      const { getByTestId } = render(<ShippingAddressForm {...defaultProps} />)

      fireEvent.changeText(getByTestId("text-input-Address line 1"), "456 Oak Ave")

      expect(defaultProps.onAddressChange).toHaveBeenCalledWith({
        ...mockAddress,
        line1: "456 Oak Ave",
      })
    })

    it("calls onAddressChange when address line 2 changes", () => {
      const { getByTestId } = render(<ShippingAddressForm {...defaultProps} />)

      fireEvent.changeText(getByTestId("text-input-Address line 2"), "Suite 100")

      expect(defaultProps.onAddressChange).toHaveBeenCalledWith({
        ...mockAddress,
        line2: "Suite 100",
      })
    })
  })

  describe("validation errors via errorMessage", () => {
    it("passes PO Box error to line1 errorMessage", () => {
      const address = { ...mockAddress, line1: "P.O. Box 123" }
      const { getByTestId } = render(
        <ShippingAddressForm {...defaultProps} address={address} />,
      )

      expect(getByTestId("error-Address line 1").props.children).toBe(
        "P.O. Boxes are not allowed",
      )
    })

    it("passes PO Box error to line2 errorMessage", () => {
      const address = { ...mockAddress, line2: "PO Box 456" }
      const { getByTestId } = render(
        <ShippingAddressForm {...defaultProps} address={address} />,
      )

      expect(getByTestId("error-Address line 2").props.children).toBe(
        "P.O. Boxes are not allowed",
      )
    })

    it("does not pass errorMessage for valid address fields", () => {
      const { queryByTestId } = render(<ShippingAddressForm {...defaultProps} />)

      expect(queryByTestId("error-Address line 1")).toBeNull()
      expect(queryByTestId("error-Postal code")).toBeNull()
    })

    it("passes invalid postal code error to errorMessage", () => {
      const address = { ...mockAddress, postalCode: "ABCDE" }
      const { getByTestId } = render(
        <ShippingAddressForm {...defaultProps} address={address} />,
      )

      expect(getByTestId("error-Postal code").props.children).toBe("Invalid postal code")
    })

    it("passes minChars error for short city", () => {
      const address = { ...mockAddress, city: "X" }
      const { getByTestId } = render(
        <ShippingAddressForm {...defaultProps} address={address} />,
      )

      expect(getByTestId("error-City").props.children).toBe("Min 2 chars")
    })
  })

  describe("onValidityChange", () => {
    it("calls onValidityChange with true for a complete address", () => {
      const onValidityChange = jest.fn()
      render(
        <ShippingAddressForm {...defaultProps} onValidityChange={onValidityChange} />,
      )

      expect(onValidityChange).toHaveBeenCalledWith(true)
    })

    it("calls onValidityChange with false for an incomplete address", () => {
      const onValidityChange = jest.fn()
      const emptyAddress: ShippingAddress = {
        firstName: "",
        lastName: "",
        line1: "",
        line2: "",
        city: "",
        region: "",
        postalCode: "",
        countryCode: "",
      }
      render(
        <ShippingAddressForm
          {...defaultProps}
          address={emptyAddress}
          onValidityChange={onValidityChange}
        />,
      )

      expect(onValidityChange).toHaveBeenCalledWith(false)
    })

    it("calls onValidityChange with false when firstName is too short", () => {
      const onValidityChange = jest.fn()
      render(
        <ShippingAddressForm
          {...defaultProps}
          address={{ ...mockAddress, firstName: "A" }}
          onValidityChange={onValidityChange}
        />,
      )

      expect(onValidityChange).toHaveBeenCalledWith(false)
    })

    it("calls onValidityChange with false for PO Box address", () => {
      const onValidityChange = jest.fn()
      render(
        <ShippingAddressForm
          {...defaultProps}
          address={{ ...mockAddress, line1: "P.O. Box 123" }}
          onValidityChange={onValidityChange}
        />,
      )

      expect(onValidityChange).toHaveBeenCalledWith(false)
    })

    it("does not crash when onValidityChange is not provided", () => {
      expect(() => {
        render(<ShippingAddressForm {...defaultProps} />)
      }).not.toThrow()
    })
  })

  describe("interactions", () => {
    it("navigates to state selection screen", () => {
      const { getByTestId } = render(<ShippingAddressForm {...defaultProps} />)

      fireEvent(getByTestId("press-State"), "touchEnd")

      expect(mockNavigate).toHaveBeenCalledWith("selectionScreen", {
        title: "State",
        options: [
          { value: "NY", label: "New York" },
          { value: "CA", label: "California" },
        ],
        selectedValue: "NY",
        onSelect: expect.any(Function),
      })
    })

    it("navigates to country selection screen", () => {
      const { getByTestId } = render(<ShippingAddressForm {...defaultProps} />)

      fireEvent(getByTestId("press-Country"), "touchEnd")

      expect(mockNavigate).toHaveBeenCalledWith("selectionScreen", {
        title: "Country",
        options: [
          { value: "US", label: "United States" },
          { value: "CA", label: "Canada" },
        ],
        selectedValue: "US",
        onSelect: expect.any(Function),
      })
    })
  })
})
