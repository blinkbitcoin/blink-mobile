import React from "react"
import { render } from "@testing-library/react-native"
import { ThemeProvider } from "@rn-vui/themed"

import { InputField } from "@app/components/card-screen/input-field"
import { MultiLineField } from "@app/components/card-screen/multi-line-field"
import { light } from "@app/rne-theme/colors"
import theme from "@app/rne-theme/theme"

import { surfaceColor } from "../../helpers/surface-color"

const renderThemed = (ui: React.ReactElement) =>
  render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>)

/** A field nobody can press takes the static grey7; a press target or an
 *  editable input keeps the tappable grey5 (blink-wip#1871). */
describe("card-screen field surfaces", () => {
  describe("InputField", () => {
    it("paints a read-only field grey7", () => {
      const { getByText } = renderThemed(<InputField label="Name" value="Satoshi" />)

      expect(surfaceColor(getByText("Satoshi"))).toBe(light.grey7)
    })

    it("keeps a pressable field grey5", () => {
      const { getByText } = renderThemed(
        <InputField label="Name" value="Satoshi" onPress={jest.fn()} />,
      )

      expect(surfaceColor(getByText("Satoshi"))).toBe(light.grey5)
    })

    it("keeps an editable field grey5", () => {
      const { getByDisplayValue } = renderThemed(
        <InputField label="Name" value="Satoshi" onChangeText={jest.fn()} />,
      )

      expect(surfaceColor(getByDisplayValue("Satoshi"))).toBe(light.grey5)
    })
  })

  describe("MultiLineField", () => {
    const lines = ["Satoshi Nakamoto", "123 Main Street"]

    it("paints a static field grey7", () => {
      const { getByText } = renderThemed(<MultiLineField lines={lines} />)

      expect(surfaceColor(getByText("Satoshi Nakamoto"))).toBe(light.grey7)
    })

    it("keeps a pressable field grey5", () => {
      const { getByText } = renderThemed(
        <MultiLineField lines={lines} onPress={jest.fn()} />,
      )

      expect(surfaceColor(getByText("Satoshi Nakamoto"))).toBe(light.grey5)
    })
  })
})
