import React from "react"
import {
  ActivityIndicator,
  StyleSheet,
  Text as ReactNativeText,
  ViewStyle,
} from "react-native"
import { fireEvent, render, screen } from "@testing-library/react-native"

import { Chip } from "@app/components/atomic/chip"

jest.mock("@rn-vui/themed", () => ({
  Text: (props: React.ComponentProps<typeof ReactNativeText>) => (
    <ReactNativeText {...props} />
  ),
  useTheme: () => ({ theme: { colors: { accent: "accent" } } }),
  /** The real styles, run on sentinel colours, so each style shows which token it picked. */
  makeStyles: (factory: (theme: { colors: Record<string, string> }) => object) => () =>
    factory({
      colors: {
        accent: "accent",
        surfaceInteractive: "surfaceInteractive",
        textOnAccent: "textOnAccent",
      },
    }),
}))

const callerStyle: ViewStyle = { alignSelf: "center" }

const chipStyle = () => StyleSheet.flatten(screen.getByRole("button").props.style)
const labelStyle = (label: string) =>
  StyleSheet.flatten(screen.getByText(label).props.style)

describe("Chip", () => {
  const onPress = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("is a button named by its label, on the interactive surface in the accent", () => {
    render(<Chip label="Change amount" onPress={onPress} />)

    expect(screen.getByRole("button").props.accessibilityLabel).toBe("Change amount")
    expect(chipStyle().backgroundColor).toBe("surfaceInteractive")
    expect(labelStyle("Change amount").color).toBe("accent")
    expect(screen.getByRole("button").props.accessibilityState).toEqual({
      selected: false,
      disabled: false,
      busy: false,
    })
  })

  it("reads its accessibilityLabel instead of the label when given one", () => {
    render(<Chip label="25%" accessibilityLabel="Quarter" onPress={onPress} />)

    expect(screen.getByRole("button").props.accessibilityLabel).toBe("Quarter")
  })

  it("calls onPress when pressed", () => {
    render(<Chip label="Change amount" onPress={onPress} />)

    fireEvent.press(screen.getByRole("button"))

    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it("fills with the accent and reads as selected when selected", () => {
    render(<Chip label="50%" selected onPress={onPress} />)

    expect(chipStyle().backgroundColor).toBe("accent")
    expect(labelStyle("50%").color).toBe("textOnAccent")
    expect(screen.getByRole("button").props.accessibilityState.selected).toBe(true)
  })

  it("dims, reads as disabled and ignores presses when disabled", () => {
    render(<Chip label="50%" disabled onPress={onPress} />)

    fireEvent.press(screen.getByRole("button"))

    expect(onPress).not.toHaveBeenCalled()
    expect(chipStyle().opacity).toBe(0.5)
    expect(screen.getByRole("button").props.accessibilityState.disabled).toBe(true)
  })

  it("spins over a hidden label that keeps its space, and reads as busy, not selected", () => {
    render(<Chip label="75%" selected loading onPress={onPress} />)

    expect(screen.UNSAFE_getByType(ActivityIndicator)).toBeTruthy()
    expect(labelStyle("75%").opacity).toBe(0)
    expect(chipStyle().backgroundColor).toBe("surfaceInteractive")
    expect(screen.getByRole("button").props.accessibilityState).toEqual({
      selected: false,
      disabled: false,
      busy: true,
    })
  })

  it("draws no spinner when not loading", () => {
    render(<Chip label="75%" onPress={onPress} />)

    expect(screen.UNSAFE_queryByType(ActivityIndicator)).toBeNull()
    expect(labelStyle("75%").opacity).toBeUndefined()
  })

  it("takes a style from its caller after its own", () => {
    render(<Chip label="Change amount" onPress={onPress} style={callerStyle} />)

    expect(chipStyle().alignSelf).toBe("center")
  })

  it("carries its test ID only when given one", () => {
    const { rerender } = render(
      <Chip label="25%" onPress={onPress} testID="convert-25%" />,
    )
    expect(screen.getByTestId("convert-25%")).toBeTruthy()

    rerender(<Chip label="25%" onPress={onPress} />)
    expect(screen.queryByTestId("convert-25%")).toBeNull()
  })
})
