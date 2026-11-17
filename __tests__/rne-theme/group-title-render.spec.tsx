import React from "react"
import { StyleProp, StyleSheet, Text, TextStyle } from "react-native"
import { render } from "@testing-library/react-native"
import { ThemeProvider } from "@rn-vui/themed"

import { ActionField } from "@app/components/action-field"
import { InfoSection, InputField } from "@app/components/card-screen"
import { PasswordInput } from "@app/components/password-input"
import { light } from "@app/rne-theme/colors"
import { fonts } from "@app/rne-theme/fonts"
import theme from "@app/rne-theme/theme"
import { groupTitleGap } from "@app/rne-theme/tokens"
import { SettingsGroup } from "@app/screens/settings-screen/group"

/**
 * The title gap spec reads the style source. This one renders the shared components under
 * the real theme, so a title that loses its colour, size or gap at runtime fails here even
 * when the source still names the token (blink-wip#2107). SettingsGroup is the case that
 * slipped: an undefined `titleStyle` replaced the theme's text style.
 */

type HostNode = { props: { style?: unknown }; parent: HostNode | null }

const styleOf = (node: unknown): TextStyle =>
  StyleSheet.flatten((node as HostNode).props.style as StyleProp<TextStyle>) ?? {}

/** The nearest ancestor that sets `prop`, and its value. */
const ancestorStyle = (node: unknown, prop: string) => {
  for (let current = (node as HostNode).parent; current; current = current.parent) {
    const style = StyleSheet.flatten(current.props.style as never) as
      | Record<string, unknown>
      | undefined
    if (style && prop in style) return style[prop]
  }
  return undefined
}

const renderThemed = (ui: React.ReactElement) =>
  render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>)

const Row: React.FC = () => <Text>Row</Text>

describe("group titles render textSecondary, 5px above their content", () => {
  describe("SettingsGroup", () => {
    it("draws the title in textSecondary, Source Sans 14/20, without a titleStyle", () => {
      const { getByText } = renderThemed(<SettingsGroup name="Account" items={[Row]} />)

      expect(styleOf(getByText("Account"))).toMatchObject({
        color: light.textSecondary,
        fontFamily: fonts.regular,
        fontSize: 14,
        lineHeight: 20,
      })
    })

    it("lets the caller's titleStyle win", () => {
      const { getByText } = renderThemed(
        <SettingsGroup
          name="Danger zone"
          items={[Row]}
          titleStyle={{ color: light.error }}
        />,
      )

      expect(styleOf(getByText("Danger zone")).color).toBe(light.error)
    })

    it("puts the card 5px below the title", () => {
      const { getByText } = renderThemed(<SettingsGroup name="Account" items={[Row]} />)

      expect(ancestorStyle(getByText("Row"), "marginTop")).toBe(groupTitleGap)
    })
  })

  it("InfoSection", () => {
    const { getByText } = renderThemed(
      <InfoSection
        title="Card information"
        items={[{ label: "Time", value: "10:58" }]}
      />,
    )
    const title = getByText("Card information")

    expect(styleOf(title).color).toBe(light.textSecondary)
    expect(ancestorStyle(title, "gap")).toBe(groupTitleGap)
  })

  it("ActionField", () => {
    const { getByText } = renderThemed(
      <ActionField label="API key" value="blink_123" icon="copy-paste" />,
    )
    const label = getByText("API key")

    expect(styleOf(label).color).toBe(light.textSecondary)
    expect(ancestorStyle(label, "gap")).toBe(groupTitleGap)
  })

  it("card InputField puts 5px under the label and keeps 3px above helper text", () => {
    const { getByText } = renderThemed(
      <InputField label="Daily spending" value="100" helperText="Optional" />,
    )
    const label = getByText("Daily spending")

    expect(styleOf(label)).toMatchObject({
      color: light.textSecondary,
      marginBottom: groupTitleGap,
    })
    expect(ancestorStyle(label, "gap")).toBeUndefined()
    expect(styleOf(getByText("Optional")).marginTop).toBe(3)
  })

  it("card InputField keeps 3px under an editable field", () => {
    const { getByText } = renderThemed(
      <InputField
        label="Daily spending"
        value="100"
        helperText="Optional"
        onChangeText={jest.fn()}
      />,
    )

    expect(styleOf(getByText("Daily spending")).marginBottom).toBe(groupTitleGap)
    expect(ancestorStyle(getByText("Optional"), "marginTop")).toBe(3)
  })

  it("PasswordInput", () => {
    const { getByText } = renderThemed(
      <PasswordInput label="Password" value="" onChangeText={jest.fn()} />,
    )

    expect(styleOf(getByText("Password"))).toMatchObject({
      color: light.textSecondary,
      marginBottom: groupTitleGap,
    })
  })
})
