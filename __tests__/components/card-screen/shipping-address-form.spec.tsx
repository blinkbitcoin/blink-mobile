import React from "react"
import { Text as RNText, TextInput as RNTextInput, View } from "react-native"
import { render, fireEvent } from "@testing-library/react-native"

import { ShippingAddressForm } from "@app/components/card-screen/shipping-address-form"
import { ShippingAddress } from "@app/screens/card-screen/card-mock-data"

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
          postalCode: () => "Postal code",
          country: () => "Country",
        },
      },
    },
  }),
}))

jest.mock("@app/screens/card-screen/country-region-data", () => ({
  COUNTRIES: [
    { value: "USA", label: "United States" },
    { value: "CAN", label: "Canada" },
  ],
  getRegionsByCountry: (code: string) => {
    if (code === "USA")
      return [
        { value: "NY", label: "New York" },
        { value: "CA", label: "California" },
      ]
    if (code === "CAN")
      return [
        { value: "ON", label: "Ontario" },
        { value: "BC", label: "British Columbia" },
      ]
    return []
  },
  getIsoAlpha2: (code: string) => {
    if (code === "USA") return "US"
    if (code === "CAN") return "CA"
    return undefined
  },
}))

jest.mock("@app/components/card-screen/input-field", () => ({
  InputField: ({
    label,
    value,
    onPress,
    onChangeText,
  }: {
    label: string
    value: string
    onPress?: () => void
    onChangeText?: (text: string) => void
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
    countryCode: "USA",
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
          { value: "USA", label: "United States" },
          { value: "CAN", label: "Canada" },
        ],
        selectedValue: "USA",
        onSelect: expect.any(Function),
      })
    })
  })
})
