import React from "react"
import { Text as RNText, View } from "react-native"
import { render, fireEvent } from "@testing-library/react-native"

import { CardStatusLayout } from "@app/components/card-screen/card-status-layout"

jest.mock("@rn-vui/themed", () => ({
  Text: (props: React.ComponentProps<typeof RNText>) => <RNText {...props} />,
  useTheme: () => ({
    theme: {
      colors: {
        _green: "#22C55E",
        black: "#000000",
        grey2: "#666666",
        grey5: "#F5F5F5",
      },
    },
  }),
  makeStyles: () => () => ({
    screen: {},
    content: {},
    heroSection: {},
    cardSection: {},
    iconContainer: {},
    textContainer: {},
    title: {},
    subtitle: {},
    bottomSection: {},
  }),
}))

jest.mock("@app/components/atomic/galoy-icon", () => ({
  GaloyIcon: ({ name }: { name: string; size: number; color: string }) => (
    <View testID={`galoy-icon-${name}`}>
      <RNText>{name}</RNText>
    </View>
  ),
}))

jest.mock("@app/components/atomic/galoy-primary-button", () => ({
  GaloyPrimaryButton: ({ title, onPress }: { title: string; onPress: () => void }) => (
    <View testID="galoy-primary-button" onTouchEnd={onPress}>
      <RNText>{title}</RNText>
    </View>
  ),
}))

jest.mock("@app/components/blink-card/blink-card", () => ({
  BlinkCard: () => <View testID="blink-card" />,
}))

jest.mock("@app/components/screen", () => ({
  Screen: ({ children }: { children: React.ReactNode }) => (
    <View testID="screen">{children}</View>
  ),
}))

jest.mock("@app/components/card-screen/add-to-wallet-button", () => ({
  AddToWalletButton: ({ onPress }: { onPress: () => void }) => (
    <View testID="add-to-wallet-button" onTouchEnd={onPress}>
      <RNText>Add to Wallet</RNText>
    </View>
  ),
}))

describe("CardStatusLayout", () => {
  const mockOnPrimaryButtonPress = jest.fn()
  const mockOnAddToWallet = jest.fn()

  const defaultProps = {
    title: "Card is on the way",
    subtitle: "Your card has been shipped and should arrive soon.",
    buttonLabel: "Continue",
    onPrimaryButtonPress: mockOnPrimaryButtonPress,
    iconName: "check-badge" as const,
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("rendering", () => {
    it("renders without crashing", () => {
      const { toJSON } = render(<CardStatusLayout {...defaultProps} />)

      expect(toJSON()).toBeTruthy()
    })

    it("displays title and subtitle", () => {
      const { getByText } = render(<CardStatusLayout {...defaultProps} />)

      expect(getByText("Card is on the way")).toBeTruthy()
      expect(getByText("Your card has been shipped and should arrive soon.")).toBeTruthy()
    })

    it("displays button label", () => {
      const { getByText } = render(<CardStatusLayout {...defaultProps} />)

      expect(getByText("Continue")).toBeTruthy()
    })

    it("renders the icon", () => {
      const { getByTestId } = render(<CardStatusLayout {...defaultProps} />)

      expect(getByTestId("galoy-icon-check-badge")).toBeTruthy()
    })
  })

  describe("interactions", () => {
    it("calls onPrimaryButtonPress when button pressed", () => {
      const { getByTestId } = render(<CardStatusLayout {...defaultProps} />)

      fireEvent(getByTestId("galoy-primary-button"), "touchEnd")

      expect(mockOnPrimaryButtonPress).toHaveBeenCalledTimes(1)
    })
  })

  describe("BlinkCard visibility", () => {
    it("shows BlinkCard when showCard is true (default)", () => {
      const { getByTestId } = render(<CardStatusLayout {...defaultProps} />)

      expect(getByTestId("blink-card")).toBeTruthy()
    })

    it("hides BlinkCard when showCard is false", () => {
      const { queryByTestId } = render(
        <CardStatusLayout {...defaultProps} showCard={false} />,
      )

      expect(queryByTestId("blink-card")).toBeNull()
    })
  })

  describe("AddToWalletButton visibility", () => {
    it("shows AddToWalletButton when showAddToWallet is true and onAddToWallet provided", () => {
      const { getByTestId } = render(
        <CardStatusLayout
          {...defaultProps}
          showAddToWallet={true}
          onAddToWallet={mockOnAddToWallet}
        />,
      )

      expect(getByTestId("add-to-wallet-button")).toBeTruthy()
    })

    it("hides AddToWalletButton when showAddToWallet is false", () => {
      const { queryByTestId } = render(
        <CardStatusLayout
          {...defaultProps}
          showAddToWallet={false}
          onAddToWallet={mockOnAddToWallet}
        />,
      )

      expect(queryByTestId("add-to-wallet-button")).toBeNull()
    })

    it("hides AddToWalletButton when onAddToWallet is not provided", () => {
      const { queryByTestId } = render(
        <CardStatusLayout {...defaultProps} showAddToWallet={true} />,
      )

      expect(queryByTestId("add-to-wallet-button")).toBeNull()
    })

    it("calls onAddToWallet when AddToWallet button pressed", () => {
      const { getByTestId } = render(
        <CardStatusLayout
          {...defaultProps}
          showAddToWallet={true}
          onAddToWallet={mockOnAddToWallet}
        />,
      )

      fireEvent(getByTestId("add-to-wallet-button"), "touchEnd")

      expect(mockOnAddToWallet).toHaveBeenCalledTimes(1)
    })
  })
})
