import fs from "fs"
import path from "path"

import { it } from "@jest/globals"
import React from "react"
import { StyleSheet, View, ViewStyle, TextStyle } from "react-native"
import { render, screen } from "@testing-library/react-native"
import { ThemeProvider } from "@rn-vui/themed"

import { ActionButton } from "@app/components/action-button"
import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import theme from "@app/rne-theme/theme"
import {
  RECEIVE_ACTIONS_GAP,
  RECEIVE_INPUTS_GUTTER,
} from "@app/screens/receive-bitcoin-screen/layout"

/**
 * The on-chain receive row holds Copy, Share and New. On the narrowest phone we
 * support (320dp) it must stay on one line in every locale: labels ellipsize,
 * they never wrap. Jest has no layout engine, so this checks the two things
 * that make that true: every label is single-line and allowed to shrink, and
 * the parts that cannot shrink fit in the row with room left for a label.
 */
const SCREEN_WIDTH = 320
const SCREEN_GUTTER = RECEIVE_INPUTS_GUTTER
const ROW_GAP = RECEIVE_ACTIONS_GAP
const BUTTON_COUNT = 3
const ICON_SIZE = 16
// Room for one glyph and the ellipsis at 14px Source Sans Pro.
const MIN_LABEL_WIDTH = 16

const TRANSLATIONS_DIR = path.resolve(
  __dirname,
  "..",
  "..",
  "app",
  "i18n",
  "raw-i18n",
  "translations",
)

type Labels = { copy: string; share: string; newAddress: string }

loadLocale("en")
const LL = i18nObject("en")

const labelsByLocale: Array<[string, Labels]> = [
  [
    "en",
    {
      copy: LL.ReceiveScreen.copyInvoice(),
      share: LL.ReceiveScreen.shareInvoice(),
      newAddress: LL.ReceiveScreen.newAddress(),
    },
  ],
  ...fs
    .readdirSync(TRANSLATIONS_DIR)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((file): [string, Labels] => {
      const { ReceiveScreen: receive } = JSON.parse(
        fs.readFileSync(path.join(TRANSLATIONS_DIR, file), "utf8"),
      )
      return [
        path.basename(file, ".json"),
        {
          copy: receive.copyInvoice,
          share: receive.shareInvoice,
          newAddress: receive.newAddress,
        },
      ]
    }),
]

const styles = StyleSheet.create({
  row: { width: SCREEN_WIDTH - 2 * SCREEN_GUTTER, flexDirection: "row" },
})

const renderRow = ({ copy, share, newAddress }: Labels) =>
  render(
    <ThemeProvider theme={theme}>
      <View style={styles.row}>
        <ActionButton
          label={copy}
          icon="copy-paste"
          onPress={jest.fn()}
          accessibilityHint=""
        />
        <ActionButton
          label={share}
          icon="share"
          onPress={jest.fn()}
          accessibilityHint=""
        />
        <ActionButton
          label={newAddress}
          icon="refresh"
          onPress={jest.fn()}
          accessibilityHint=""
        />
      </View>
    </ThemeProvider>,
  )

describe("receive action row at 320dp", () => {
  it.each(labelsByLocale)(
    "%s: every label is single-line and shrinkable",
    (_, labels) => {
      renderRow(labels)

      for (const label of [labels.copy, labels.share, labels.newAddress]) {
        const text = screen.getByText(label)
        const button = screen.getByLabelText(label)

        expect(text.props.numberOfLines).toBe(1)
        expect(text.props.ellipsizeMode).toBe("tail")
        expect(StyleSheet.flatten<TextStyle>(text.props.style).flexShrink).toBe(1)

        const container = StyleSheet.flatten<ViewStyle>(button.props.style)
        expect(container.flexShrink).toBe(1)
        expect(container.minWidth).toBe(0)
      }
    },
  )

  it("leaves room for a label once padding, gaps and icons are placed", () => {
    renderRow(labelsByLocale[0][1])

    const container = StyleSheet.flatten<ViewStyle>(
      screen.getByLabelText(LL.ReceiveScreen.copyInvoice()).props.style,
    )
    const padding = 2 * Number(container.paddingHorizontal)
    const innerGap = Number(container.columnGap)
    const fixedPerButton = padding + innerGap + ICON_SIZE

    const available = SCREEN_WIDTH - 2 * SCREEN_GUTTER - (BUTTON_COUNT - 1) * ROW_GAP
    const needed = BUTTON_COUNT * (fixedPerButton + MIN_LABEL_WIDTH)

    expect(needed).toBeLessThanOrEqual(available)
  })
})
