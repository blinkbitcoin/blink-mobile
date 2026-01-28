import React from "react"
import { Text as RNText, View } from "react-native"
import { render } from "@testing-library/react-native"

import { BlinkCard } from "@app/components/blink-card/blink-card"

jest.mock("@react-native-community/blur", () => ({
  BlurView: "BlurView",
}))

jest.mock("react-native-linear-gradient", () => ({
  LinearGradient: ({ children }: { children: React.ReactNode }) => (
    <View>{children}</View>
  ),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      CardFlow: {
        validThruLabel: () => "VALID THRU",
        cardFrozenTitle: () => "Card frozen",
        cardFrozenSubtitle: () => "Card is temporarily disabled",
      },
    },
  }),
}))

jest.mock("@rn-vui/themed", () => ({
  Text: (props: React.ComponentProps<typeof RNText>) => <RNText {...props} />,
  useTheme: () => ({
    theme: {
      colors: {
        _primary1: "#F7931A",
        _primary2: "#FF9500",
        _white: "#FFFFFF",
        _black: "#000000",
        error: "#FF0000",
      },
    },
  }),
  makeStyles: () => () => ({
    cardWrapper: {},
    card: {},
    topRow: {},
    cardNumber: {},
    cardNumberSpacer: {},
    bottomRow: {},
    holderName: {},
    validThruContainer: {},
    validThruLabel: {},
    validThruValue: {},
    frozenOverlay: {},
    blurContainer: {},
    blurOverlay: {},
    blurTint: {},
    lockCircle: {},
    lockCircleBackground: {},
    frozenTitle: {},
    frozenSubtitle: {},
  }),
}))

jest.mock("@app/components/atomic/galoy-icon/galoy-icon", () => ({
  GaloyIcon: ({ name }: { name: string }) => <View testID={`icon-${name}`} />,
}))

const renderWithProviders = (component: React.ReactElement) => {
  return render(component)
}

describe("BlinkCard", () => {
  const defaultProps = {
    cardNumber: "4242 4242 4242 4242",
    holderName: "JOHN DOE",
    validThruDate: "2028-12-01",
    isFrozen: false,
  }

  describe("rendering basic card", () => {
    it("renders without crashing", () => {
      const { toJSON } = renderWithProviders(<BlinkCard {...defaultProps} />)

      expect(toJSON()).toBeTruthy()
    })

    it("displays the holder name", () => {
      const { getByText } = renderWithProviders(<BlinkCard {...defaultProps} />)

      expect(getByText("JOHN DOE")).toBeTruthy()
    })

    it("displays the valid thru label", () => {
      const { getByText } = renderWithProviders(<BlinkCard {...defaultProps} />)

      expect(getByText("VALID THRU")).toBeTruthy()
    })

    it("displays masked card number by default", () => {
      const { getByText } = renderWithProviders(<BlinkCard {...defaultProps} />)

      expect(getByText("•••• •••• •••• 4242")).toBeTruthy()
    })

    it("displays masked valid thru date by default", () => {
      const { getByText } = renderWithProviders(<BlinkCard {...defaultProps} />)

      expect(getByText("•• / ••")).toBeTruthy()
    })
  })

  describe("rendering with showCardDetails", () => {
    it("displays full card number when showCardDetails is true", () => {
      const { getByText } = renderWithProviders(
        <BlinkCard {...defaultProps} showCardDetails={true} />,
      )

      expect(getByText("4242 4242 4242 4242")).toBeTruthy()
    })

    it("displays valid thru date when showCardDetails is true", () => {
      const { getByText } = renderWithProviders(
        <BlinkCard
          {...defaultProps}
          validThruDate={new Date(2028, 11, 1)}
          showCardDetails={true}
        />,
      )

      expect(getByText("12/ 28")).toBeTruthy()
    })
  })

  describe("rendering frozen state", () => {
    it("renders without crashing when frozen", () => {
      const { toJSON } = renderWithProviders(
        <BlinkCard {...defaultProps} isFrozen={true} />,
      )

      expect(toJSON()).toBeTruthy()
    })

    it("displays frozen title when card is frozen", () => {
      const { getByText } = renderWithProviders(
        <BlinkCard {...defaultProps} isFrozen={true} />,
      )

      expect(getByText("Card frozen")).toBeTruthy()
    })

    it("displays frozen subtitle when card is frozen", () => {
      const { getByText } = renderWithProviders(
        <BlinkCard {...defaultProps} isFrozen={true} />,
      )

      expect(getByText("Card is temporarily disabled")).toBeTruthy()
    })

    it("does not display frozen messages when card is not frozen", () => {
      const { queryByText } = renderWithProviders(
        <BlinkCard {...defaultProps} isFrozen={false} />,
      )

      expect(queryByText("Card frozen")).toBeNull()
      expect(queryByText("Card is temporarily disabled")).toBeNull()
    })
  })

  describe("rendering with different card data", () => {
    it("displays different holder name", () => {
      const { getByText } = renderWithProviders(
        <BlinkCard {...defaultProps} holderName="SATOSHI NAKAMOTO" />,
      )

      expect(getByText("SATOSHI NAKAMOTO")).toBeTruthy()
    })

    it("displays different card number masked", () => {
      const { getByText } = renderWithProviders(
        <BlinkCard {...defaultProps} cardNumber="5555 5555 5555 1234" />,
      )

      expect(getByText("•••• •••• •••• 1234")).toBeTruthy()
    })

    it("handles card number with different last four digits", () => {
      const { getByText } = renderWithProviders(
        <BlinkCard {...defaultProps} cardNumber="1234 5678 9012 3456" />,
      )

      expect(getByText("•••• •••• •••• 3456")).toBeTruthy()
    })
  })

  describe("rendering with Date object for validThruDate", () => {
    it("handles Date object for validThruDate", () => {
      const { getByText } = renderWithProviders(
        <BlinkCard {...defaultProps} validThruDate={new Date("2030-06-15")} />,
      )

      expect(getByText("VALID THRU")).toBeTruthy()
    })

    it("displays correct date when showCardDetails with Date object", () => {
      const { getByText } = renderWithProviders(
        <BlinkCard
          {...defaultProps}
          validThruDate={new Date("2030-06-15")}
          showCardDetails={true}
        />,
      )

      expect(getByText("06/ 30")).toBeTruthy()
    })
  })

  describe("state transitions", () => {
    it("transitions from unfrozen to frozen state", () => {
      const { queryByText, rerender } = renderWithProviders(
        <BlinkCard {...defaultProps} isFrozen={false} />,
      )

      expect(queryByText("Card frozen")).toBeNull()

      rerender(<BlinkCard {...defaultProps} isFrozen={true} />)

      expect(queryByText("Card frozen")).toBeTruthy()
    })

    it("transitions from frozen to unfrozen state", () => {
      const { queryByText, rerender } = renderWithProviders(
        <BlinkCard {...defaultProps} isFrozen={true} />,
      )

      expect(queryByText("Card frozen")).toBeTruthy()

      rerender(<BlinkCard {...defaultProps} isFrozen={false} />)

      expect(queryByText("Card frozen")).toBeNull()
    })

    it("transitions from hidden to visible card details", () => {
      const { queryByText, rerender } = renderWithProviders(
        <BlinkCard {...defaultProps} showCardDetails={false} />,
      )

      expect(queryByText("•••• •••• •••• 4242")).toBeTruthy()
      expect(queryByText("4242 4242 4242 4242")).toBeNull()

      rerender(<BlinkCard {...defaultProps} showCardDetails={true} />)

      expect(queryByText("4242 4242 4242 4242")).toBeTruthy()
    })
  })

  describe("edge cases", () => {
    it("handles empty holder name", () => {
      const { toJSON } = renderWithProviders(
        <BlinkCard {...defaultProps} holderName="" />,
      )

      expect(toJSON()).toBeTruthy()
    })

    it("handles holder name with special characters", () => {
      const { getByText } = renderWithProviders(
        <BlinkCard {...defaultProps} holderName="JOSÉ GARCÍA" />,
      )

      expect(getByText("JOSÉ GARCÍA")).toBeTruthy()
    })

    it("handles very long holder name", () => {
      const { getByText } = renderWithProviders(
        <BlinkCard {...defaultProps} holderName="ALEXANDER CHRISTOPHER BENJAMIN" />,
      )

      expect(getByText("ALEXANDER CHRISTOPHER BENJAMIN")).toBeTruthy()
    })
  })
})
