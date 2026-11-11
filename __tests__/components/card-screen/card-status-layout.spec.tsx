import React from "react"
import { Text as RNText, View } from "react-native"
import { render, fireEvent } from "@testing-library/react-native"

import { CardStatusLayout } from "@app/components/card-screen/card-status-layout"

jest.mock("@rn-vui/themed", () => ({
  Text: (props: React.ComponentProps<typeof RNText>) => <RNText {...props} />,
  useTheme: () => ({
    theme: {
      colors: {
        success: "#22C55E",
        textOnBackground: "#000000",
        textMuted: "#666666",
        surfaceInteractive: "#F5F5F5",
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
  AddToWalletButton: ({
    onPress,
    disabled,
  }: {
    onPress: () => void
    disabled: boolean
  }) => (
    <View
      testID="add-to-wallet-button"
      accessibilityState={{ disabled }}
      onTouchEnd={onPress}
    >
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
    onAddToWallet: mockOnAddToWallet,
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
    it("shows AddToWalletButton when showAddToWallet is true", () => {
      const { getByTestId } = render(
        <CardStatusLayout {...defaultProps} showAddToWallet={true} />,
      )

      expect(getByTestId("add-to-wallet-button")).toBeTruthy()
    })

    it("hides AddToWalletButton when showAddToWallet is false", () => {
      const { queryByTestId } = render(
        <CardStatusLayout {...defaultProps} showAddToWallet={false} />,
      )

      expect(queryByTestId("add-to-wallet-button")).toBeNull()
    })

    it("calls onAddToWallet when AddToWalletButton is pressed", () => {
      const { getByTestId } = render(
        <CardStatusLayout {...defaultProps} showAddToWallet={true} />,
      )

      fireEvent(getByTestId("add-to-wallet-button"), "touchEnd")

      expect(mockOnAddToWallet).toHaveBeenCalledTimes(1)
    })

    it("disables AddToWalletButton while the card is being added", () => {
      const { getByTestId } = render(
        <CardStatusLayout {...defaultProps} isAddingToWallet={true} />,
      )

      expect(getByTestId("add-to-wallet-button").props.accessibilityState).toEqual({
        disabled: true,
      })
    })
  })
})
