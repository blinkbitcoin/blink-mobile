import React from "react"
import { render, fireEvent } from "@testing-library/react-native"

import { SettingsCard } from "@app/screens/settings-screen/settings-card"

jest.mock("@rn-vui/themed", () => {
  const colors: Record<string, string> = {
    grey2: "#999",
    grey5: "#f5f5f5",
    black: "#000",
    primary: "#007",
    error: "#f00",
    transparent: "transparent",
  }
  return {
    makeStyles:
      (
        fn: (
          theme: { colors: Record<string, string> },
          params: Record<string, string | undefined>,
        ) => Record<string, object>,
      ) =>
      (params: Record<string, string | undefined> = {}) =>
        fn({ colors }, params),
    Text: ({ children, ...props }: { children: React.ReactNode }) =>
      React.createElement("Text", props, children),
    useTheme: () => ({ theme: { colors } }),
  }
})

jest.mock("@app/components/atomic/galoy-icon", () => ({
  GaloyIcon: () => null,
}))

describe("SettingsCard", () => {
  const defaultProps = {
    title: "Backup",
    description: "Secure your wallet",
    onPress: jest.fn(),
  }

  it("renders title and description", () => {
    const { getByText } = render(<SettingsCard {...defaultProps} />)

    expect(getByText("Backup")).toBeTruthy()
    expect(getByText("Secure your wallet")).toBeTruthy()
  })

  it("calls onPress when pressed", () => {
    const onPress = jest.fn()
    const { getByText } = render(<SettingsCard {...defaultProps} onPress={onPress} />)

    fireEvent.press(getByText("Backup"))

    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it("renders with custom border color", () => {
    const { getByText } = render(<SettingsCard {...defaultProps} borderColor="error" />)

    expect(getByText("Backup")).toBeTruthy()
  })

  it("renders with icon", () => {
    const { getByText } = render(<SettingsCard {...defaultProps} icon="warning" />)

    expect(getByText("Backup")).toBeTruthy()
  })
})
