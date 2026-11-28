import React from "react"
import { Text as RNText, View } from "react-native"
import { render, fireEvent, within } from "@testing-library/react-native"

import { DeliveryStep } from "@app/screens/card-screen/replace-card-screens/steps/delivery-step"
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
  }),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      CardFlow: {
        Delivery: {
          snailMail: () => "Snail mail delivery",
          snailMailUnavailable: () => "Too unreliable to support",
        },
      },
    },
  }),
}))

let mockCourier = {
  title: "Courier delivery",
  businessDays: "3-7 business days",
  firstCardPrice: "FREE",
  replacementPrice: "$100.00",
  isReplacementFree: false,
}

jest.mock("@app/screens/card-screen/hooks", () => ({
  useCourierDelivery: () => mockCourier,
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
  SelectableOptionRow: ({
    title,
    subtitle,
    value,
    valueColor,
    isSelected,
    onPress,
    isDisabled,
  }: {
    title: string
    subtitle: string
    value: string
    valueColor?: string
    isSelected: boolean
    onPress?: () => void
    isDisabled?: boolean
  }) => (
    <View
      testID={`option-${title}`}
      accessibilityRole="radio"
      accessibilityState={{ selected: isSelected, disabled: Boolean(isDisabled) }}
      onTouchEnd={isDisabled ? undefined : onPress}
    >
      <RNText>{title}</RNText>
      <RNText>{subtitle}</RNText>
      <RNText testID={`value-${title}`} accessibilityHint={valueColor}>
        {value}
      </RNText>
    </View>
  ),
  ShippingAddressForm: ({ address }: { address: ShippingAddress }) => (
    <View testID="shipping-address-form">
      <RNText>{address.line1}</RNText>
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
    firstName: "Satoshi",
    lastName: "Nakamoto",
    line1: "123 Main Street",
    line2: "Apt 4B",
    city: "New York",
    region: "NY",
    postalCode: "10001",
    countryCode: "US",
  }

  const mockKycAddress: ShippingAddress = {
    ...mockCustomAddress,
    line1: "789 Verified Road",
  }

  const defaultProps = {
    selectedDelivery: "courier" as const,
    onSelectDelivery: jest.fn(),
    kycAddress: mockKycAddress,
    useKycAddress: false,
    onToggleUseKycAddress: jest.fn(),
    customAddress: mockCustomAddress,
    onCustomAddressChange: jest.fn(),
  }

  beforeEach(jest.clearAllMocks)

  afterEach(() => {
    mockCourier = {
      ...mockCourier,
      replacementPrice: "$100.00",
      isReplacementFree: false,
    }
  })

  describe("rendering", () => {
    it("renders without crashing", () => {
      const { toJSON } = render(<DeliveryStep {...defaultProps} />)

      expect(toJSON()).toBeTruthy()
    })

    it("displays delivery options", () => {
      const { getByText } = render(<DeliveryStep {...defaultProps} />)

      expect(getByText("Snail mail delivery")).toBeTruthy()
      expect(getByText("Courier delivery")).toBeTruthy()
    })

    /** Under the options: where the card goes, and an address other than home. */
    it("shows the privacy tip between the options and the address", () => {
      const tree = JSON.stringify(render(<DeliveryStep {...defaultProps} />).toJSON())

      expect(tree.indexOf("settings-group")).toBeLessThan(
        tree.indexOf("privacy-tip-card"),
      )
      expect(tree.indexOf("privacy-tip-card")).toBeLessThan(
        tree.indexOf("kyc-address-choice"),
      )
    })
  })

  /** Cards ship by courier; snail mail is shown greyed as not offered (D124, D128). */
  describe("delivery options", () => {
    it("shows snail mail as not offered", () => {
      const { getByTestId, getByText } = render(<DeliveryStep {...defaultProps} />)

      expect(getByText("Too unreliable to support")).toBeTruthy()
      expect(getByTestId("option-Snail mail delivery").props.accessibilityState).toEqual({
        selected: false,
        disabled: true,
      })
    })

    it("shows the courier with its business days and the replacement's price", () => {
      const { getByText, getByTestId } = render(<DeliveryStep {...defaultProps} />)

      expect(getByText("3-7 business days")).toBeTruthy()
      expect(getByTestId("value-Courier delivery").props.children).toBe("$100.00")
    })

    it("shows a free replacement in the success color", () => {
      mockCourier = { ...mockCourier, replacementPrice: "FREE", isReplacementFree: true }
      const { getByTestId } = render(<DeliveryStep {...defaultProps} />)

      expect(getByTestId("value-Courier delivery").props.children).toBe("FREE")
      expect(getByTestId("value-Courier delivery").props.accessibilityHint).toBe(
        "#00C853",
      )
    })

    it("shows a paid replacement in the text color", () => {
      const { getByTestId } = render(<DeliveryStep {...defaultProps} />)

      expect(getByTestId("value-Courier delivery").props.accessibilityHint).toBe(
        "#000000",
      )
    })
  })

  /** The KYC address is a choice, unticked by default (D42, D123). */
  describe("the KYC address", () => {
    it("is offered as it is, unticked", () => {
      const { getByTestId } = render(<DeliveryStep {...defaultProps} />)

      const choice = getByTestId("kyc-address-choice")
      expect(choice.props.accessibilityState).toEqual({ checked: false })
      expect(choice.props.accessibilityHint).toBe("789 Verified Road")
    })

    it("toggles from the choice", () => {
      const { getByTestId } = render(<DeliveryStep {...defaultProps} />)

      fireEvent(getByTestId("kyc-address-choice"), "touchEnd")

      expect(defaultProps.onToggleUseKycAddress).toHaveBeenCalledTimes(1)
    })

    it("puts the address form under the choice", () => {
      const { getByTestId } = render(<DeliveryStep {...defaultProps} />)

      const form = within(getByTestId("kyc-address-choice")).getByTestId(
        "shipping-address-form",
      )
      expect(within(form).getByText("123 Main Street")).toBeTruthy()
    })
  })

  describe("interactions", () => {
    it("chooses the courier when pressed", () => {
      const { getByTestId } = render(<DeliveryStep {...defaultProps} />)

      fireEvent(getByTestId("option-Courier delivery"), "touchEnd")

      expect(defaultProps.onSelectDelivery).toHaveBeenCalledWith("courier")
    })

    it("cannot choose snail mail", () => {
      const { getByTestId } = render(<DeliveryStep {...defaultProps} />)

      fireEvent(getByTestId("option-Snail mail delivery"), "touchEnd")

      expect(defaultProps.onSelectDelivery).not.toHaveBeenCalled()
    })
  })

  describe("selection state", () => {
    it("highlights the courier when chosen", () => {
      const { getByTestId } = render(<DeliveryStep {...defaultProps} />)

      expect(getByTestId("option-Courier delivery").props.accessibilityState).toEqual({
        selected: true,
        disabled: false,
      })
    })
  })
})
