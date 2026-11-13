import React from "react"
import { StyleSheet, Text as RNText, View, ViewStyle } from "react-native"
import { render } from "@testing-library/react-native"
import type { ReactTestInstance } from "react-test-renderer"

import { GaloyButtonField } from "@app/components/atomic/galoy-button-field"

jest.mock("@app/components/atomic/galoy-icon", () => ({
  GaloyIcon: ({ name, ...props }: { name: string }) => (
    <View {...props} testID={`galoy-icon-${name}`} />
  ),
}))

/** Every role gets its own sentinel, so a fill or icon that reads the wrong token shows
 *  up by name rather than by a value two tokens happen to share. */
jest.mock("@rn-vui/themed", () => ({
  Text: (props: React.ComponentProps<typeof RNText>) => <RNText {...props} />,
  useTheme: () => ({
    theme: {
      colors: {
        accent: "accent",
        surfaceInteractive: "surfaceInteractive",
        surfacePressed: "surfacePressed",
        error: "error",
        errorBackground: "errorBackground",
      },
    },
  }),
  makeStyles: () => () => ({
    contentContainerStyle: {},
    primaryTextStyle: {},
    iconStyle: {},
  }),
}))

/** The Pressable's style is a function of its pressed state; resolve it for one state. */
const fillFor = (field: ReactTestInstance, pressed: boolean): ViewStyle => {
  let node: ReactTestInstance | null = field
  while (node && typeof node.props.style !== "function") node = node.parent
  return StyleSheet.flatten(node?.props.style({ pressed })) ?? {}
}

const renderField = (props: Partial<React.ComponentProps<typeof GaloyButtonField>>) =>
  render(<GaloyButtonField value="Value" iconName="pencil" {...props} />)

describe("GaloyButtonField", () => {
  it("fills with the tappable surface at rest and the pressed surface while held", () => {
    const { getByText } = renderField({})
    const field = getByText("Value")

    expect(fillFor(field, false).backgroundColor).toBe("surfaceInteractive")
    expect(fillFor(field, true).backgroundColor).toBe("surfacePressed")
  })

  it("keeps the tappable surface when disabled, dimmed", () => {
    const { getByText } = renderField({ disabled: true })
    const fill = fillFor(getByText("Value"), false)

    expect(fill.backgroundColor).toBe("surfaceInteractive")
    expect(fill.opacity).toBe(0.3)
  })

  it("fills with the error background in error, pressed or not", () => {
    const { getByText } = renderField({ error: true })
    const field = getByText("Value")

    expect(fillFor(field, false).backgroundColor).toBe("errorBackground")
    expect(fillFor(field, true).backgroundColor).toBe("errorBackground")
  })

  it("paints the icon in accent, which no fill uses", () => {
    const { getByTestId, getByText } = renderField({})
    const field = getByText("Value")

    expect(getByTestId("galoy-icon-pencil").props.color).toBe("accent")
    expect(fillFor(field, false).backgroundColor).not.toBe("accent")
    expect(fillFor(field, true).backgroundColor).not.toBe("accent")
  })

  it("paints the icon in the error colour in error", () => {
    const { getByTestId } = renderField({ error: true, iconName: "info" })

    expect(getByTestId("galoy-icon-info").props.color).toBe("error")
  })
})
