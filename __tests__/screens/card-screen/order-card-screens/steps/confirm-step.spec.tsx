import React from "react"
import { Text as RNText, View } from "react-native"
import { render } from "@testing-library/react-native"

import { ConfirmStep } from "@app/screens/card-screen/order-card-screens/steps/confirm-step"
import { ShippingAddress } from "@app/screens/card-screen/card-mock-data"

jest.mock("@rn-vui/themed", () => ({
  Text: (props: React.ComponentProps<typeof RNText>) => <RNText {...props} />,
  useTheme: () => ({
    theme: {
      colors: {
        _green: "#00C853",
      },
    },
  }),
  makeStyles: () => () => ({
    section: {},
    sectionTitle: {},
    settingsGroupContainer: {},
    dividerStyle: {},
  }),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      CardFlow: {
        OrderPhysicalCard: {
          Shipping: {
            standardDelivery: () => "Standard delivery",
            expressDelivery: () => "Express delivery",
            businessDays: ({ day1, day2 }: { day1: string; day2: string }) =>
              `${day1}-${day2} business days`,
            free: () => "FREE",
          },
          Confirm: {
            orderSummary: () => "Order summary",
            cardDesign: () => "Card design",
            delivery: () => "Delivery",
            deliveryTime: () => "Delivery time",
            shippingCost: () => "Shipping cost",
            shippingAddress: () => "Shipping address",
            important: () => "Important",
            bullet1: () => "Your card will be shipped to the address provided",
            bullet2: () => "Delivery times are estimates and may vary",
            bullet3: () => "You will receive a notification when your card ships",
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
  InfoSection: ({
    title,
    items,
  }: {
    title: string
    items: { label: string; value: string; valueColor?: string }[]
  }) => (
    <View testID="info-section">
      <RNText>{title}</RNText>
      {items.map((item: { label: string; value: string }) => (
        <View key={item.label} testID={`info-item-${item.label}`}>
          <RNText>{item.label}</RNText>
          <RNText testID={`info-value-${item.label}`}>{item.value}</RNText>
        </View>
      ))}
    </View>
  ),
  InfoCard: ({ title, bulletItems }: { title: string; bulletItems?: string[] }) => (
    <View testID="info-card">
      <RNText>{title}</RNText>
      {bulletItems?.map((item: string) => <RNText key={item}>{item}</RNText>)}
    </View>
  ),
  MultiLineField: ({ lines }: { lines: string[] }) => (
    <View testID="multi-line-field">
      {lines.map((line: string) => (
        <RNText key={line}>{line}</RNText>
      ))}
    </View>
  ),
}))

describe("ConfirmStep", () => {
  const mockAddress: ShippingAddress = {
    fullName: "Satoshi Nakamoto",
    addressLine1: "123 Main Street",
    addressLine2: "Apt 4B",
    city: "New York",
    state: "NY",
    postalCode: "10001",
    country: "United States",
  }

  beforeEach(jest.clearAllMocks)

  describe("rendering", () => {
    it("renders without crashing", () => {
      const { toJSON } = render(
        <ConfirmStep deliveryType="standard" shippingAddress={mockAddress} />,
      )

      expect(toJSON()).toBeTruthy()
    })

    it("displays order summary title", () => {
      const { getByText } = render(
        <ConfirmStep deliveryType="standard" shippingAddress={mockAddress} />,
      )

      expect(getByText("Order summary")).toBeTruthy()
    })

    it("displays summary labels", () => {
      const { getByText } = render(
        <ConfirmStep deliveryType="standard" shippingAddress={mockAddress} />,
      )

      expect(getByText("Card design")).toBeTruthy()
      expect(getByText("Delivery")).toBeTruthy()
      expect(getByText("Delivery time")).toBeTruthy()
      expect(getByText("Shipping cost")).toBeTruthy()
    })

    it("displays shipping address section", () => {
      const { getByText } = render(
        <ConfirmStep deliveryType="standard" shippingAddress={mockAddress} />,
      )

      expect(getByText("Shipping address")).toBeTruthy()
    })

    it("displays important info card with bullets", () => {
      const { getByText } = render(
        <ConfirmStep deliveryType="standard" shippingAddress={mockAddress} />,
      )

      expect(getByText("Important")).toBeTruthy()
      expect(getByText("Your card will be shipped to the address provided")).toBeTruthy()
      expect(getByText("Delivery times are estimates and may vary")).toBeTruthy()
      expect(
        getByText("You will receive a notification when your card ships"),
      ).toBeTruthy()
    })
  })

  describe("combinations", () => {
    it("displays standard delivery with free shipping and card design", () => {
      const { getByTestId } = render(
        <ConfirmStep deliveryType="standard" shippingAddress={mockAddress} />,
      )

      expect(getByTestId("info-value-Card design").props.children).toBe("Maxi orange")
      expect(getByTestId("info-value-Delivery").props.children).toBe("Standard delivery")
      expect(getByTestId("info-value-Delivery time").props.children).toBe(
        "7-10 business days",
      )
      expect(getByTestId("info-value-Shipping cost").props.children).toBe("FREE")
    })

    it("displays express delivery with paid shipping", () => {
      const { getByTestId } = render(
        <ConfirmStep deliveryType="express" shippingAddress={mockAddress} />,
      )

      expect(getByTestId("info-value-Delivery").props.children).toBe("Express delivery")
      expect(getByTestId("info-value-Delivery time").props.children).toBe(
        "1-2 business days",
      )
      expect(getByTestId("info-value-Shipping cost").props.children).toBe("$15.00")
    })
  })

  describe("address display", () => {
    it("shows address lines via MultiLineField", () => {
      const { getByTestId, getByText } = render(
        <ConfirmStep deliveryType="standard" shippingAddress={mockAddress} />,
      )

      expect(getByTestId("multi-line-field")).toBeTruthy()
      expect(getByText("Satoshi Nakamoto")).toBeTruthy()
      expect(getByText("123 Main Street")).toBeTruthy()
      expect(getByText("Apt 4B")).toBeTruthy()
      expect(getByText("New York, NY 10001")).toBeTruthy()
      expect(getByText("United States")).toBeTruthy()
    })
  })
})
