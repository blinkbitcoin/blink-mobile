import React from "react"
import { Text as RNText, View } from "react-native"
import { render } from "@testing-library/react-native"

import { ConfirmStep } from "@app/screens/card-screen/replace-card-screens/steps/confirm-step"

jest.mock("@rn-vui/themed", () => ({
  useTheme: () => ({
    theme: {
      colors: {
        success: "#00C853",
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
          Confirm: {
            requestSummary: () => "Request summary",
            issueType: () => "Issue type",
            delivery: () => "Delivery",
            deliveryTime: () => "Delivery time",
            shippingCost: () => "Shipping cost",
            importantInformation: () => "Important information",
            samePin: () => "Your new card will have the same PIN number",
          },
        },
      },
    },
  }),
}))

let mockCourier = {
  title: "Courier delivery",
  businessDays: "3-7 business days",
  firstCardPrice: "FREE",
  replacementPrice: "FREE",
  isReplacementFree: true,
}

jest.mock("@app/screens/card-screen/hooks", () => ({
  useCourierDelivery: () => mockCourier,
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
      {items.map((item: { label: string; value: string; valueColor?: string }) => (
        <View key={item.label} testID={`info-item-${item.label}`}>
          <RNText>{item.label}</RNText>
          <RNText testID={`info-value-${item.label}`} accessibilityHint={item.valueColor}>
            {item.value}
          </RNText>
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
      const { toJSON } = render(<ConfirmStep issueType="lost" isVirtualCard={false} />)

      expect(toJSON()).toBeTruthy()
    })

    it("displays request summary title", () => {
      const { getByText } = render(<ConfirmStep issueType="lost" isVirtualCard={false} />)

      expect(getByText("Request summary")).toBeTruthy()
    })

    it("displays all summary labels including delivery", () => {
      const { getByText, getByTestId } = render(
        <ConfirmStep issueType="lost" isVirtualCard={false} />,
      )

      expect(getByText("Issue type")).toBeTruthy()
      expect(getByText("Delivery")).toBeTruthy()
      expect(getByText("Delivery time")).toBeTruthy()
      expect(getByTestId("info-item-Courier delivery")).toBeTruthy()
    })

    /** The cost row is labelled with the courier itself (D126); the replacement is
     *  free until its payment step exists. */
    it("shows the courier, its business days and its price", () => {
      const { getByTestId } = render(
        <ConfirmStep issueType="lost" isVirtualCard={false} />,
      )

      expect(getByTestId("info-value-Issue type").props.children).toBe("Lost card")
      expect(getByTestId("info-value-Delivery").props.children).toBe("Courier delivery")
      expect(getByTestId("info-value-Delivery time").props.children).toBe(
        "3-7 business days",
      )
      expect(getByTestId("info-value-Courier delivery").props.children).toBe("FREE")
      expect(getByTestId("info-value-Courier delivery").props.accessibilityHint).toBe(
        "#00C853",
      )
    })

    it("shows the courier's price from the config once it has one", () => {
      mockCourier = {
        ...mockCourier,
        replacementPrice: "$100.00",
        isReplacementFree: false,
      }
      const { getByTestId } = render(
        <ConfirmStep issueType="stolen" isVirtualCard={false} />,
      )

      expect(getByTestId("info-value-Issue type").props.children).toBe("Stolen card")
      expect(getByTestId("info-value-Courier delivery").props.children).toBe("$100.00")
      expect(
        getByTestId("info-value-Courier delivery").props.accessibilityHint,
      ).toBeUndefined()
      mockCourier = { ...mockCourier, replacementPrice: "FREE", isReplacementFree: true }
    })
  })

  describe("virtual card", () => {
    it("displays only issue type without delivery info", () => {
      const { getByTestId, queryByTestId } = render(
        <ConfirmStep issueType="lost" isVirtualCard={true} />,
      )

      expect(getByTestId("info-value-Issue type").props.children).toBe("Lost card")
      expect(queryByTestId("info-item-Delivery")).toBeNull()
      expect(queryByTestId("info-item-Delivery time")).toBeNull()
      expect(queryByTestId("info-item-Courier delivery")).toBeNull()
    })
  })

  /** The confirmation says only that the PIN stays (D122, D126). Whether the numbers
   *  change and what happens to the current card wait for the issuer's answer (P5). */
  describe("important information", () => {
    const reasons = ["lost", "stolen", "damaged"] as const

    reasons.forEach((issueType) => {
      it(`says only that the new card keeps the PIN for a ${issueType} card`, () => {
        const { getByText, getByTestId } = render(
          <ConfirmStep issueType={issueType} isVirtualCard={false} />,
        )

        expect(getByText("Important information")).toBeTruthy()
        expect(getByText("Your new card will have the same PIN number")).toBeTruthy()
        expect(getByTestId("info-card").children).toHaveLength(2)
      })
    })

    it("says the same for a virtual card", () => {
      const { getByText } = render(<ConfirmStep issueType="lost" isVirtualCard={true} />)

      expect(getByText("Your new card will have the same PIN number")).toBeTruthy()
    })
  })
})
