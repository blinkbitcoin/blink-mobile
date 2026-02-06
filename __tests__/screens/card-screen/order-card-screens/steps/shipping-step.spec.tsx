import React from "react"
import { Text as RNText, View } from "react-native"
import { render, fireEvent } from "@testing-library/react-native"

import { ShippingStep } from "@app/screens/card-screen/order-card-screens/steps/shipping-step"
import { ShippingAddress } from "@app/screens/card-screen/card-mock-data"

jest.mock("@rn-vui/themed", () => ({
  Text: (props: React.ComponentProps<typeof RNText>) => <RNText {...props} />,
  useTheme: () => ({
    theme: {
      colors: {
        black: "#000000",
        primary: "#3B82F6",
        grey2: "#666666",
        grey4: "#E0E0E0",
        transparent: "transparent",
        _green: "#00C853",
      },
    },
  }),
  makeStyles: () => () => ({
    section: {},
    sectionTitle: {},
    settingsGroupContainer: {},
    dividerStyle: {},
    checkboxFormGroup: {},
    deliveryCard: {},
  }),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      CardFlow: {
        OrderPhysicalCard: {
          Shipping: {
            registeredAddress: () => "Registered address",
            useRegisteredAddress: () => "Use registered address as shipping address",
            delivery: () => "Delivery",
            standardDelivery: () => "Standard delivery",
            expressDelivery: () => "Express delivery",
            businessDays: ({ day1, day2 }: { day1: string; day2: string }) =>
              `${day1}-${day2} business days`,
            free: () => "FREE",
            deliveryInformation: () => "Delivery information",
            bullet1: () => "Delivery bullet 1",
            bullet2: () => "Delivery bullet 2",
            bullet3: () => "Delivery bullet 3",
            bullet4: () => "Delivery bullet 4",
            cardFeatures: () => "Card features",
            feature1: () => "Feature 1",
            feature2: () => "Feature 2",
            feature3: () => "Feature 3",
            feature4: () => "Feature 4",
          },
        },
        ShippingAddress: {
          important: () => "Important",
          importantDescription: () => "Important description",
          noPOBoxes: () => "No PO Boxes",
          signatureRequired: () => "Signature required",
          supportedRegions: () => "US only",
        },
      },
    },
  }),
}))

jest.mock("@app/config/feature-flags-context", () => ({
  useRemoteConfig: () => ({
    replaceCardDeliveryConfig: {
      standard: { minDays: 7, maxDays: 10, priceUsd: 0 },
      express: { minDays: 1, maxDays: 2, priceUsd: 15 },
    },
  }),
}))

jest.mock("@app/hooks/use-display-currency", () => ({
  useDisplayCurrency: () => ({
    formatCurrency: ({
      amountInMajorUnits,
    }: {
      amountInMajorUnits: number
      currency: string
    }) => `$${amountInMajorUnits.toFixed(2)}`,
  }),
}))

jest.mock("@app/graphql/generated", () => ({
  WalletCurrency: { Usd: "USD" },
}))

jest.mock("@app/screens/card-screen/card-mock-data", () => ({
  MOCK_USER: {
    registeredAddress: {
      fullName: "Satoshi Nakamoto",
      addressLine1: "123 Main Street",
      addressLine2: "Apt 4B",
      city: "New York",
      state: "NY",
      postalCode: "10001",
      country: "United States",
    },
  },
  shippingAddressToLines: (address: ShippingAddress, includeFullName: boolean) => {
    const lines: string[] = []
    if (includeFullName) lines.push(address.fullName)
    lines.push(address.addressLine1)
    if (address.addressLine2) lines.push(address.addressLine2)
    lines.push(`${address.city}, ${address.state} ${address.postalCode}`)
    lines.push(address.country)
    return lines
  },
}))

jest.mock("@app/components/card-screen", () => ({
  OptionRow: ({
    title,
    subtitle,
    value,
  }: {
    title: string
    subtitle: string
    value: string
  }) => (
    <View testID="option-row">
      <RNText>{title}</RNText>
      <RNText>{subtitle}</RNText>
      <RNText testID="option-value">{value}</RNText>
    </View>
  ),
  MultiLineField: ({ lines }: { lines: string[] }) => (
    <View testID="multi-line-field">
      {lines.map((line: string) => (
        <RNText key={line}>{line}</RNText>
      ))}
    </View>
  ),
  CheckboxRow: ({
    label,
    isChecked,
    onPress,
  }: {
    label: string
    isChecked: boolean
    onPress: () => void
  }) => (
    <View
      testID="checkbox-row"
      accessibilityRole="checkbox"
      accessibilityState={{ checked: isChecked }}
      onTouchEnd={onPress}
    >
      <RNText>{label}</RNText>
    </View>
  ),
  ShippingAddressForm: ({ address }: { address: ShippingAddress }) => (
    <View testID="shipping-address-form">
      <RNText>{address.addressLine1}</RNText>
    </View>
  ),
  InfoCard: ({ title, bulletItems }: { title: string; bulletItems: string[] }) => (
    <View testID="info-card">
      <RNText>{title}</RNText>
      {bulletItems?.map((item: string) => <RNText key={item}>{item}</RNText>)}
    </View>
  ),
}))

describe("ShippingStep", () => {
  const mockCustomAddress: ShippingAddress = {
    fullName: "Satoshi Nakamoto",
    addressLine1: "123 Main Street",
    addressLine2: "Apt 4B",
    city: "New York",
    state: "NY",
    postalCode: "10001",
    country: "United States",
  }

  const defaultProps = {
    useRegisteredAddress: true,
    onToggleUseRegisteredAddress: jest.fn(),
    customAddress: mockCustomAddress,
    onCustomAddressChange: jest.fn(),
  }

  beforeEach(jest.clearAllMocks)

  describe("rendering", () => {
    it("renders without crashing", () => {
      const { toJSON } = render(<ShippingStep {...defaultProps} />)

      expect(toJSON()).toBeTruthy()
    })

    it("displays registered address section title", () => {
      const { getByText } = render(<ShippingStep {...defaultProps} />)

      expect(getByText("Registered address")).toBeTruthy()
    })

    it("displays registered address", () => {
      const { getByText } = render(<ShippingStep {...defaultProps} />)

      expect(getByText("123 Main Street")).toBeTruthy()
      expect(getByText("New York, NY 10001")).toBeTruthy()
      expect(getByText("United States")).toBeTruthy()
    })

    it("displays checkbox", () => {
      const { getByText } = render(<ShippingStep {...defaultProps} />)

      expect(getByText("Use registered address as shipping address")).toBeTruthy()
    })

    it("displays standard delivery OptionRow with business days and FREE", () => {
      const { getByText, getByTestId } = render(<ShippingStep {...defaultProps} />)

      expect(getByText("Standard delivery")).toBeTruthy()
      expect(getByText("7-10 business days")).toBeTruthy()
      expect(getByTestId("option-value").props.children).toBe("FREE")
    })

    it("displays delivery information card", () => {
      const { getByText } = render(<ShippingStep {...defaultProps} />)

      expect(getByText("Delivery information")).toBeTruthy()
      expect(getByText("Delivery bullet 1")).toBeTruthy()
      expect(getByText("Delivery bullet 2")).toBeTruthy()
      expect(getByText("Delivery bullet 3")).toBeTruthy()
      expect(getByText("Delivery bullet 4")).toBeTruthy()
    })

    it("displays card features card", () => {
      const { getByText } = render(<ShippingStep {...defaultProps} />)

      expect(getByText("Card features")).toBeTruthy()
      expect(getByText("Feature 1")).toBeTruthy()
      expect(getByText("Feature 2")).toBeTruthy()
      expect(getByText("Feature 3")).toBeTruthy()
      expect(getByText("Feature 4")).toBeTruthy()
    })
  })

  describe("checkbox toggle", () => {
    it("hides form when checked", () => {
      const { queryByTestId } = render(
        <ShippingStep {...defaultProps} useRegisteredAddress={true} />,
      )

      expect(queryByTestId("shipping-address-form")).toBeNull()
    })

    it("shows form when unchecked", () => {
      const { getByTestId } = render(
        <ShippingStep {...defaultProps} useRegisteredAddress={false} />,
      )

      expect(getByTestId("shipping-address-form")).toBeTruthy()
    })

    it("calls onToggleUseRegisteredAddress when pressed", () => {
      const { getByTestId } = render(<ShippingStep {...defaultProps} />)

      fireEvent(getByTestId("checkbox-row"), "touchEnd")

      expect(defaultProps.onToggleUseRegisteredAddress).toHaveBeenCalledTimes(1)
    })
  })

  describe("address display", () => {
    it("shows registered address when checked", () => {
      const { getByText } = render(
        <ShippingStep {...defaultProps} useRegisteredAddress={true} />,
      )

      expect(getByText("123 Main Street")).toBeTruthy()
      expect(getByText("Apt 4B")).toBeTruthy()
      expect(getByText("New York, NY 10001")).toBeTruthy()
      expect(getByText("United States")).toBeTruthy()
    })

    it("shows custom address when unchecked", () => {
      const customAddr: ShippingAddress = {
        fullName: "Joe Nakamoto",
        addressLine1: "456 Oak Avenue",
        addressLine2: "",
        city: "Austin",
        state: "TX",
        postalCode: "73301",
        country: "United States",
      }

      const { getByTestId, getAllByText } = render(
        <ShippingStep
          {...defaultProps}
          useRegisteredAddress={false}
          customAddress={customAddr}
        />,
      )

      expect(getByTestId("multi-line-field")).toBeTruthy()
      expect(getAllByText("456 Oak Avenue").length).toBeGreaterThanOrEqual(1)
      expect(getAllByText("Austin, TX 73301").length).toBeGreaterThanOrEqual(1)
    })
  })

  describe("shipping form", () => {
    it("shows ShippingAddressForm when unchecked", () => {
      const { getByTestId } = render(
        <ShippingStep {...defaultProps} useRegisteredAddress={false} />,
      )

      expect(getByTestId("shipping-address-form")).toBeTruthy()
    })

    it("shows Important InfoCard when unchecked", () => {
      const { getByText } = render(
        <ShippingStep {...defaultProps} useRegisteredAddress={false} />,
      )

      expect(getByText("Important")).toBeTruthy()
      expect(getByText("No PO Boxes")).toBeTruthy()
      expect(getByText("Signature required")).toBeTruthy()
      expect(getByText("US only")).toBeTruthy()
    })
  })
})
