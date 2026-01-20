import React from "react"
import { Text as ReactNativeText } from "react-native"
import { render, fireEvent } from "@testing-library/react-native"

import { WalletToggleButton } from "@app/components/wallet-selector/wallet-toggle-button"

jest.mock("@rn-vui/themed", () => ({
  Text: (props: React.ComponentProps<typeof ReactNativeText>) => (
    <ReactNativeText {...props} />
  ),
  useTheme: () => ({
    theme: {
      colors: {
        primary: "primary",
        grey4: "grey4",
        grey6: "grey6",
      },
    },
  }),
  makeStyles: () => () => ({
    button: {},
    buttonDisabled: {},
  }),
}))

jest.mock("react-native-vector-icons/Ionicons", () => "Icon")

describe("WalletToggleButton", () => {
  const mockOnPress = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("renders icon when not loading", () => {
    const { getByTestId } = render(
      <WalletToggleButton
        loading={false}
        disabled={false}
        onPress={mockOnPress}
        testID="toggle-button"
      />,
    )

    const button = getByTestId("toggle-button")
    expect(button).toBeTruthy()
  })

  it("renders activity indicator when loading", () => {
    const { getByTestId } = render(
      <WalletToggleButton
        loading={true}
        disabled={false}
        onPress={mockOnPress}
        testID="toggle-button"
      />,
    )

    const button = getByTestId("toggle-button")
    expect(button).toBeTruthy()
  })

  it("calls onPress when pressed and not disabled", () => {
    const { getByTestId } = render(
      <WalletToggleButton
        loading={false}
        disabled={false}
        onPress={mockOnPress}
        testID="toggle-button"
      />,
    )

    const button = getByTestId("toggle-button")
    fireEvent.press(button)

    expect(mockOnPress).toHaveBeenCalledTimes(1)
  })

  it("does not call onPress when disabled", () => {
    const { getByTestId } = render(
      <WalletToggleButton
        loading={false}
        disabled={true}
        onPress={mockOnPress}
        testID="toggle-button"
      />,
    )

    const button = getByTestId("toggle-button")
    fireEvent.press(button)

    expect(mockOnPress).not.toHaveBeenCalled()
  })

  it("does not call onPress when loading", () => {
    const { getByTestId } = render(
      <WalletToggleButton
        loading={true}
        disabled={false}
        onPress={mockOnPress}
        testID="toggle-button"
      />,
    )

    const button = getByTestId("toggle-button")
    fireEvent.press(button)

    expect(mockOnPress).toHaveBeenCalledTimes(1)
  })

  it("renders with custom containerStyle", () => {
    const customStyle = { marginTop: 10 }
    const { getByTestId } = render(
      <WalletToggleButton
        loading={false}
        disabled={false}
        onPress={mockOnPress}
        containerStyle={customStyle}
        testID="toggle-button"
      />,
    )

    const button = getByTestId("toggle-button")
    expect(button).toBeTruthy()
  })
})
