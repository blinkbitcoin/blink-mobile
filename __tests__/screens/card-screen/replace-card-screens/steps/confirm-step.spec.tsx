import React from "react"
import { Text as RNText, View } from "react-native"
import { render } from "@testing-library/react-native"

import { ConfirmStep } from "@app/screens/card-screen/replace-card-screens/steps/confirm-step"

jest.mock("@rn-vui/themed", () => ({
  useTheme: () => ({
    theme: {
      colors: {
        _green: "#00C853",
      },
    },
  }),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      CardFlow: {
        ReplaceCard: {
          ReportIssue: {
            lostCard: () => "Lost card",
            stolenCard: () => "Stolen card",
            damagedCard: () => "Damaged card",
          },
          Delivery: {
            standardDelivery: () => "Standard delivery",
            expressDelivery: () => "Express delivery",
            businessDays: ({ day1, day2 }: { day1: string; day2: string }) =>
              `${day1}-${day2} business days`,
            free: () => "FREE",
          },
          Confirm: {
            requestSummary: () => "Request summary",
            issueType: () => "Issue type",
            delivery: () => "Delivery",
            deliveryTime: () => "Delivery time",
            shippingCost: () => "Shipping cost",
            importantInformation: () => "Important information",
            DamagedInfo: {
              bullet1: () =>
                "Your current card will remain active until the new one arrives",
              bullet2: () => "Your new card will have a new card number",
              bullet3: () => "Destroy your damaged card when the new one arrives",
            },
            LostStolenInfo: {
              bullet1: () => "Your card has been locked for your protection",
              bullet2: () => "Your new card will have a new card number",
              bullet3: () => "Your old card will be permanently canceled",
            },
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
}))

describe("ConfirmStep", () => {
  beforeEach(jest.clearAllMocks)

  describe("physical card", () => {
    it("renders without crashing", () => {
      const { toJSON } = render(
        <ConfirmStep issueType="lost" deliveryType="standard" isVirtualCard={false} />,
      )

      expect(toJSON()).toBeTruthy()
    })

    it("displays request summary title", () => {
      const { getByText } = render(
        <ConfirmStep issueType="lost" deliveryType="standard" isVirtualCard={false} />,
      )

      expect(getByText("Request summary")).toBeTruthy()
    })

    it("displays all summary labels including delivery", () => {
      const { getByText } = render(
        <ConfirmStep issueType="lost" deliveryType="standard" isVirtualCard={false} />,
      )

      expect(getByText("Issue type")).toBeTruthy()
      expect(getByText("Delivery")).toBeTruthy()
      expect(getByText("Delivery time")).toBeTruthy()
      expect(getByText("Shipping cost")).toBeTruthy()
    })

    it("displays lost/stolen bullet list", () => {
      const { getByText } = render(
        <ConfirmStep issueType="lost" deliveryType="standard" isVirtualCard={false} />,
      )

      expect(getByText("Important information")).toBeTruthy()
      expect(getByText("Your card has been locked for your protection")).toBeTruthy()
      expect(getByText("Your new card will have a new card number")).toBeTruthy()
      expect(getByText("Your old card will be permanently canceled")).toBeTruthy()
    })

    it("displays stolen bullet list same as lost", () => {
      const { getByText } = render(
        <ConfirmStep issueType="stolen" deliveryType="standard" isVirtualCard={false} />,
      )

      expect(getByText("Important information")).toBeTruthy()
      expect(getByText("Your card has been locked for your protection")).toBeTruthy()
      expect(getByText("Your new card will have a new card number")).toBeTruthy()
      expect(getByText("Your old card will be permanently canceled")).toBeTruthy()
    })

    it("displays damaged bullet list", () => {
      const { getByText } = render(
        <ConfirmStep issueType="damaged" deliveryType="standard" isVirtualCard={false} />,
      )

      expect(getByText("Important information")).toBeTruthy()
      expect(
        getByText("Your current card will remain active until the new one arrives"),
      ).toBeTruthy()
      expect(getByText("Your new card will have a new card number")).toBeTruthy()
      expect(getByText("Destroy your damaged card when the new one arrives")).toBeTruthy()
    })

    it("displays lost card with standard delivery", () => {
      const { getByTestId } = render(
        <ConfirmStep issueType="lost" deliveryType="standard" isVirtualCard={false} />,
      )

      expect(getByTestId("info-value-Issue type").props.children).toBe("Lost card")
      expect(getByTestId("info-value-Delivery").props.children).toBe("Standard delivery")
      expect(getByTestId("info-value-Delivery time").props.children).toBe(
        "7-10 business days",
      )
      expect(getByTestId("info-value-Shipping cost").props.children).toBe("FREE")
    })

    it("displays stolen card with express delivery", () => {
      const { getByTestId } = render(
        <ConfirmStep issueType="stolen" deliveryType="express" isVirtualCard={false} />,
      )

      expect(getByTestId("info-value-Issue type").props.children).toBe("Stolen card")
      expect(getByTestId("info-value-Delivery").props.children).toBe("Express delivery")
      expect(getByTestId("info-value-Delivery time").props.children).toBe(
        "1-2 business days",
      )
      expect(getByTestId("info-value-Shipping cost").props.children).toBe("$15.00")
    })

    it("displays damaged card with standard delivery", () => {
      const { getByTestId } = render(
        <ConfirmStep issueType="damaged" deliveryType="standard" isVirtualCard={false} />,
      )

      expect(getByTestId("info-value-Issue type").props.children).toBe("Damaged card")
      expect(getByTestId("info-value-Delivery").props.children).toBe("Standard delivery")
      expect(getByTestId("info-value-Shipping cost").props.children).toBe("FREE")
    })
  })

  describe("virtual card", () => {
    it("displays only issue type without delivery info", () => {
      const { getByTestId, queryByTestId } = render(
        <ConfirmStep issueType="lost" deliveryType="standard" isVirtualCard={true} />,
      )

      expect(getByTestId("info-value-Issue type").props.children).toBe("Lost card")
      expect(queryByTestId("info-item-Delivery")).toBeNull()
      expect(queryByTestId("info-item-Delivery time")).toBeNull()
      expect(queryByTestId("info-item-Shipping cost")).toBeNull()
    })

    it("displays lost/stolen bullet list", () => {
      const { getByText } = render(
        <ConfirmStep issueType="stolen" deliveryType="standard" isVirtualCard={true} />,
      )

      expect(getByText("Important information")).toBeTruthy()
      expect(getByText("Your card has been locked for your protection")).toBeTruthy()
      expect(getByText("Your new card will have a new card number")).toBeTruthy()
      expect(getByText("Your old card will be permanently canceled")).toBeTruthy()
    })

    it("displays damaged bullet list", () => {
      const { getByText } = render(
        <ConfirmStep issueType="damaged" deliveryType="standard" isVirtualCard={true} />,
      )

      expect(getByText("Important information")).toBeTruthy()
      expect(
        getByText("Your current card will remain active until the new one arrives"),
      ).toBeTruthy()
      expect(getByText("Your new card will have a new card number")).toBeTruthy()
      expect(getByText("Destroy your damaged card when the new one arrives")).toBeTruthy()
    })
  })
})
