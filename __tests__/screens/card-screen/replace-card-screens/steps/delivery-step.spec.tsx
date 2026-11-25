import React from "react"
import { Text as RNText, View } from "react-native"
import { render, fireEvent } from "@testing-library/react-native"

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
        ReplaceCard: {
          Delivery: {
            shippingAddress: () => "Shipping address",
            useRegisteredAddress: () => "Use registered address as shipping address",
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

jest.mock("@app/components/checkbox-row", () => {
  const { View, Text: RNText } = jest.requireActual("react-native")
  return {
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
  }
})

jest.mock("@app/components/card-screen", () => ({
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
    onPress: () => void
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
  MultiLineField: ({ lines }: { lines: string[] }) => (
    <View testID="multi-line-field">
      {lines.map((line: string) => (
        <RNText key={line}>{line}</RNText>
      ))}
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

  const defaultProps = {
    selectedDelivery: "courier" as const,
    onSelectDelivery: jest.fn(),
    hasRegisteredAddress: true,
    registeredAddress: mockCustomAddress,
    useRegisteredAddress: true,
    onToggleUseRegisteredAddress: jest.fn(),
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

    it("displays shipping address section", () => {
      const { getByText } = render(<DeliveryStep {...defaultProps} />)

      expect(getByText("Shipping address")).toBeTruthy()
    })

    it("displays use registered address checkbox", () => {
      const { getByText } = render(<DeliveryStep {...defaultProps} />)

      expect(getByText("Use registered address as shipping address")).toBeTruthy()
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
      expect(getByText("New York, NY, 10001")).toBeTruthy()
      expect(getByText("United States")).toBeTruthy()
    })

    it("hides address preview and shows form when checkbox unchecked", () => {
      const { queryByTestId, getByTestId } = render(
        <DeliveryStep {...defaultProps} useRegisteredAddress={false} />,
      )

      expect(queryByTestId("multi-line-field")).toBeNull()
      expect(getByTestId("shipping-address-form")).toBeTruthy()
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

  describe("no registered address", () => {
    it("hides checkbox when hasRegisteredAddress is false", () => {
      const { queryByTestId } = render(
        <DeliveryStep
          {...defaultProps}
          hasRegisteredAddress={false}
          useRegisteredAddress={false}
        />,
      )

      expect(queryByTestId("checkbox-row")).toBeNull()
    })

    it("shows form when hasRegisteredAddress is false", () => {
      const { getByTestId } = render(
        <DeliveryStep
          {...defaultProps}
          hasRegisteredAddress={false}
          useRegisteredAddress={false}
        />,
      )

      expect(getByTestId("shipping-address-form")).toBeTruthy()
    })

    it("shows checkbox when hasRegisteredAddress is true", () => {
      const { getByTestId } = render(
        <DeliveryStep {...defaultProps} hasRegisteredAddress={true} />,
      )

      expect(getByTestId("checkbox-row")).toBeTruthy()
    })
  })
})
