import React from "react"
import { Text as RNText, View } from "react-native"
import { render } from "@testing-library/react-native"

import { ConfirmStep } from "@app/screens/card-screen/order-card-screens/steps/confirm-step"
import { ShippingAddress } from "@app/screens/card-screen/types"

jest.mock("@rn-vui/themed", () => ({
  Text: (props: React.ComponentProps<typeof RNText>) => <RNText {...props} />,
  useTheme: () => ({
    theme: {
      colors: {
        success: "#00C853",
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
            bullet4: () => "Shipping address cannot be changed after order is placed",
          },
        },
      },
    },
  }),
}))

jest.mock("@app/screens/card-screen/hooks", () => ({
  useCourierDelivery: () => ({
    title: "Courier delivery",
    businessDays: "3-7 business days",
    firstCardPrice: "FREE",
    replacementPrice: "$100.00",
    isReplacementFree: false,
  }),
}))

jest.mock("@app/screens/card-screen/utils", () => ({
  addressToLines: jest.requireActual<typeof import("../../helpers/mock-address-utils")>(
    "../../helpers/mock-address-utils",
  ).mockAddressToLines,
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
    firstName: "Satoshi",
    lastName: "Nakamoto",
    line1: "123 Main Street",
    line2: "Apt 4B",
    city: "New York",
    region: "NY",
    postalCode: "10001",
    countryCode: "US",
  }

  beforeEach(jest.clearAllMocks)

  describe("rendering", () => {
    it("renders without crashing", () => {
      const { toJSON } = render(<ConfirmStep shippingAddress={mockAddress} />)

      expect(toJSON()).toBeTruthy()
    })

    it("displays order summary title", () => {
      const { getByText } = render(<ConfirmStep shippingAddress={mockAddress} />)

      expect(getByText("Order summary")).toBeTruthy()
    })

    it("displays summary labels", () => {
      const { getByText } = render(<ConfirmStep shippingAddress={mockAddress} />)

      expect(getByText("Card design")).toBeTruthy()
      expect(getByText("Delivery")).toBeTruthy()
      expect(getByText("Delivery time")).toBeTruthy()
      expect(getByText("Shipping cost")).toBeTruthy()
    })

    it("displays shipping address section", () => {
      const { getByText } = render(<ConfirmStep shippingAddress={mockAddress} />)

      expect(getByText("Shipping address")).toBeTruthy()
    })

    /** The Important box of the export is gone from the design (DS30, RV2). */
    it("shows no Important box", () => {
      const { queryByTestId } = render(<ConfirmStep shippingAddress={mockAddress} />)

      expect(queryByTestId("info-card")).toBeNull()
    })
  })

  describe("delivery", () => {
    /** The first physical card ships by courier, free (D124, D129). */
    it("shows the courier, its business days and the free first card", () => {
      const { getByTestId } = render(<ConfirmStep shippingAddress={mockAddress} />)

      expect(getByTestId("info-value-Card design").props.children).toBe("Blink Orange")
      expect(getByTestId("info-value-Delivery").props.children).toBe("Courier delivery")
      expect(getByTestId("info-value-Delivery time").props.children).toBe(
        "3-7 business days",
      )
      expect(getByTestId("info-value-Shipping cost").props.children).toBe("FREE")
    })
  })

  describe("address display", () => {
    it("shows address lines via MultiLineField", () => {
      const { getByTestId, getByText } = render(
        <ConfirmStep shippingAddress={mockAddress} />,
      )

      expect(getByTestId("multi-line-field")).toBeTruthy()
      expect(getByText("Satoshi Nakamoto")).toBeTruthy()
      expect(getByText("123 Main Street")).toBeTruthy()
      expect(getByText("Apt 4B")).toBeTruthy()
      expect(getByText("New York, NY, 10001")).toBeTruthy()
      expect(getByText("United States")).toBeTruthy()
    })
  })
})
