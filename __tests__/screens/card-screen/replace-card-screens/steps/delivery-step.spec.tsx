import React from "react"
import { Text as RNText, View } from "react-native"
import { render, fireEvent } from "@testing-library/react-native"

import { DeliveryStep } from "@app/screens/card-screen/replace-card-screens/steps/delivery-step"
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
  }),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      CardFlow: {
        ReplaceCard: {
          Delivery: {
            standardDelivery: () => "Standard delivery",
            expressDelivery: () => "Express delivery",
            businessDays: ({ day1, day2 }: { day1: string; day2: string }) =>
              `${day1}-${day2} business days`,
            free: () => "FREE",
            shippingAddress: () => "Shipping address",
            useRegisteredAddress: () => "Use registered address as shipping address",
          },
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
  SelectableOptionRow: ({
    title,
    subtitle,
    value,
    isSelected,
    onPress,
  }: {
    title: string
    subtitle: string
    value: string
    isSelected: boolean
    onPress: () => void
  }) => (
    <View
      testID={`option-${title}`}
      accessibilityRole="radio"
      accessibilityState={{ selected: isSelected }}
      onTouchEnd={onPress}
    >
      <RNText>{title}</RNText>
      <RNText>{subtitle}</RNText>
      <RNText testID={`value-${title}`}>{value}</RNText>
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
}))

jest.mock("@app/screens/settings-screen/group", () => ({
  SettingsGroup: ({ items }: { items: (() => React.ReactNode)[] }) => (
    <View testID="settings-group">
      {items.map((Item: () => React.ReactNode, idx: number) => (
        <View key={idx}>{Item()}</View>
      ))}
    </View>
  ),
}))

describe("DeliveryStep", () => {
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
    selectedDelivery: null,
    onSelectDelivery: jest.fn(),
    useRegisteredAddress: true,
    onToggleUseRegisteredAddress: jest.fn(),
    customAddress: mockCustomAddress,
    onCustomAddressChange: jest.fn(),
  }

  beforeEach(jest.clearAllMocks)

  describe("rendering", () => {
    it("renders without crashing", () => {
      const { toJSON } = render(<DeliveryStep {...defaultProps} />)

      expect(toJSON()).toBeTruthy()
    })

    it("displays delivery options", () => {
      const { getByText } = render(<DeliveryStep {...defaultProps} />)

      expect(getByText("Standard delivery")).toBeTruthy()
      expect(getByText("Express delivery")).toBeTruthy()
    })

    it("displays shipping address section", () => {
      const { getByText } = render(<DeliveryStep {...defaultProps} />)

      expect(getByText("Shipping address")).toBeTruthy()
    })

    it("displays use registered address checkbox", () => {
      const { getByText } = render(<DeliveryStep {...defaultProps} />)

      expect(getByText("Use registered address as shipping address")).toBeTruthy()
    })
  })

  describe("delivery options", () => {
    it("displays standard delivery with business days", () => {
      const { getByText } = render(<DeliveryStep {...defaultProps} />)

      expect(getByText("7-10 business days")).toBeTruthy()
    })

    it("displays standard delivery as free", () => {
      const { getByTestId } = render(<DeliveryStep {...defaultProps} />)

      expect(getByTestId("value-Standard delivery")).toBeTruthy()
      expect(getByTestId("value-Standard delivery").props.children).toBe("FREE")
    })

    it("displays express delivery with business days", () => {
      const { getByText } = render(<DeliveryStep {...defaultProps} />)

      expect(getByText("1-2 business days")).toBeTruthy()
    })

    it("displays express delivery price", () => {
      const { getByTestId } = render(<DeliveryStep {...defaultProps} />)

      expect(getByTestId("value-Express delivery").props.children).toBe("$15.00")
    })
  })

  describe("checkbox toggle", () => {
    it("hides shipping address form when using registered address", () => {
      const { queryByTestId } = render(
        <DeliveryStep {...defaultProps} useRegisteredAddress={true} />,
      )

      expect(queryByTestId("shipping-address-form")).toBeNull()
    })

    it("shows shipping address form when not using registered address", () => {
      const { getByTestId } = render(
        <DeliveryStep {...defaultProps} useRegisteredAddress={false} />,
      )

      expect(getByTestId("shipping-address-form")).toBeTruthy()
    })

    it("calls onToggleUseRegisteredAddress when checkbox pressed", () => {
      const { getByTestId } = render(<DeliveryStep {...defaultProps} />)

      fireEvent(getByTestId("checkbox-row"), "touchEnd")

      expect(defaultProps.onToggleUseRegisteredAddress).toHaveBeenCalledTimes(1)
    })
  })

  describe("address display", () => {
    it("displays registered address when checkbox checked", () => {
      const { getByText } = render(
        <DeliveryStep {...defaultProps} useRegisteredAddress={true} />,
      )

      expect(getByText("123 Main Street")).toBeTruthy()
      expect(getByText("New York, NY 10001")).toBeTruthy()
      expect(getByText("United States")).toBeTruthy()
    })

    it("displays custom address when checkbox unchecked", () => {
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
        <DeliveryStep
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

  describe("interactions", () => {
    it("calls onSelectDelivery with standard when pressed", () => {
      const { getByTestId } = render(<DeliveryStep {...defaultProps} />)

      fireEvent(getByTestId("option-Standard delivery"), "touchEnd")

      expect(defaultProps.onSelectDelivery).toHaveBeenCalledWith("standard")
    })

    it("calls onSelectDelivery with express when pressed", () => {
      const { getByTestId } = render(<DeliveryStep {...defaultProps} />)

      fireEvent(getByTestId("option-Express delivery"), "touchEnd")

      expect(defaultProps.onSelectDelivery).toHaveBeenCalledWith("express")
    })
  })

  describe("selection state", () => {
    it("highlights standard delivery when selected", () => {
      const { getByTestId } = render(
        <DeliveryStep {...defaultProps} selectedDelivery="standard" />,
      )

      const option = getByTestId("option-Standard delivery")
      expect(option.props.accessibilityState).toEqual({ selected: true })
    })

    it("highlights express delivery when selected", () => {
      const { getByTestId } = render(
        <DeliveryStep {...defaultProps} selectedDelivery="express" />,
      )

      const option = getByTestId("option-Express delivery")
      expect(option.props.accessibilityState).toEqual({ selected: true })
    })
  })
})
