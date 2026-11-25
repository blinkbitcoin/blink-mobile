import React from "react"
import { Text as RNText, View } from "react-native"
import { render, fireEvent, within } from "@testing-library/react-native"

import { ShippingStep } from "@app/screens/card-screen/order-card-screens/steps/shipping-step"
import { ShippingAddress } from "@app/screens/card-screen/types"

jest.mock("@rn-vui/themed", () => ({
  Text: (props: React.ComponentProps<typeof RNText>) => <RNText {...props} />,
  useTheme: () => ({
    theme: {
      colors: {
        textOnBackground: "#000000",
        accent: "#3B82F6",
        textMuted: "#666666",
        neutral: "#E0E0E0",
        transparent: "transparent",
        success: "#00C853",
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
            delivery: () => "Delivery",
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

jest.mock("@app/screens/card-screen/kyc-address-choice", () => ({
  KycAddressChoice: ({
    kycAddress,
    isKycAddressUsed,
    onToggle,
    children,
  }: {
    kycAddress: ShippingAddress | null
    isKycAddressUsed: boolean
    onToggle: () => void
    children: React.ReactNode
  }) => (
    <View
      testID="kyc-address-choice"
      accessibilityState={{ checked: isKycAddressUsed }}
      accessibilityHint={kycAddress?.line1}
      onTouchEnd={onToggle}
    >
      {children}
    </View>
  ),
}))

jest.mock("@app/components/card-screen", () => ({
  PrivacyTipCard: () => <View testID="privacy-tip-card" />,
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
  ShippingAddressForm: ({
    address,
    onValidityChange,
  }: {
    address: ShippingAddress
    onValidityChange?: (isValid: boolean) => void
  }) => {
    React.useEffect(() => {
      onValidityChange?.(true)
    }, [onValidityChange])
    return (
      <View testID="shipping-address-form">
        <RNText>{address.line1}</RNText>
      </View>
    )
  },
  InfoCard: ({ title, bulletItems }: { title: string; bulletItems: string[] }) => (
    <View testID="info-card">
      <RNText>{title}</RNText>
      {bulletItems?.map((item: string) => <RNText key={item}>{item}</RNText>)}
    </View>
  ),
}))

describe("ShippingStep", () => {
  const mockCustomAddress: ShippingAddress = {
    firstName: "Satoshi",
    lastName: "Nakamoto",
    line1: "456 Office Park",
    line2: "Suite 9",
    city: "New York",
    region: "NY",
    postalCode: "10001",
    countryCode: "US",
  }

  const mockKycAddress: ShippingAddress = {
    ...mockCustomAddress,
    line1: "123 Main Street",
    line2: "Apt 4B",
  }

  const defaultProps = {
    kycAddress: mockKycAddress,
    useKycAddress: false,
    onToggleUseKycAddress: jest.fn(),
    customAddress: mockCustomAddress,
    onCustomAddressChange: jest.fn(),
  }

  beforeEach(jest.clearAllMocks)

  describe("rendering", () => {
    it("renders without crashing", () => {
      const { toJSON } = render(<ShippingStep {...defaultProps} />)

      expect(toJSON()).toBeTruthy()
    })

    /** The tip comes first: where the card goes, and an address other than home. */
    it("opens with the privacy tip, above the address", () => {
      const tree = JSON.stringify(render(<ShippingStep {...defaultProps} />).toJSON())

      expect(tree.indexOf("privacy-tip-card")).toBeGreaterThan(-1)
      expect(tree.indexOf("privacy-tip-card")).toBeLessThan(
        tree.indexOf("kyc-address-choice"),
      )
    })

    /** The first physical card ships by courier, free (D124, D129). */
    it("offers the courier, with its business days and the free first card", () => {
      const { getByText, getByTestId } = render(<ShippingStep {...defaultProps} />)

      expect(getByText("Courier delivery")).toBeTruthy()
      expect(getByText("3-7 business days")).toBeTruthy()
      expect(getByTestId("option-value").props.children).toBe("FREE")
    })

    /** The design drops the tracking, signature, packaging and card-features bullets
     *  and the Important box: Rain's rules are checked on the address, not recited. */
    it("shows none of the old bullets nor the Important box", () => {
      const { queryByTestId } = render(<ShippingStep {...defaultProps} />)

      expect(queryByTestId("info-card")).toBeNull()
    })
  })

  /** The KYC address is a choice, unticked by default (D42, D123). */
  describe("the KYC address", () => {
    it("is offered as it is, unticked", () => {
      const { getByTestId } = render(<ShippingStep {...defaultProps} />)

      const choice = getByTestId("kyc-address-choice")
      expect(choice.props.accessibilityState).toEqual({ checked: false })
      expect(choice.props.accessibilityHint).toBe("123 Main Street")
    })

    it("shows the choice ticked once the member picks it", () => {
      const { getByTestId } = render(<ShippingStep {...defaultProps} useKycAddress />)

      expect(getByTestId("kyc-address-choice").props.accessibilityState).toEqual({
        checked: true,
      })
    })

    it("toggles from the choice", () => {
      const { getByTestId } = render(<ShippingStep {...defaultProps} />)

      fireEvent(getByTestId("kyc-address-choice"), "touchEnd")

      expect(defaultProps.onToggleUseKycAddress).toHaveBeenCalledTimes(1)
    })
  })

  describe("the address form", () => {
    it("sits under the KYC choice, filled with the new address", () => {
      const { getByTestId } = render(<ShippingStep {...defaultProps} />)

      const form = within(getByTestId("kyc-address-choice")).getByTestId(
        "shipping-address-form",
      )
      expect(within(form).getByText("456 Office Park")).toBeTruthy()
    })
  })
})
