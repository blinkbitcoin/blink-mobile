import { TextProps } from "@rn-vui/themed"

import { light } from "@app/rne-theme/colors"
import { fonts } from "@app/rne-theme/fonts"
import theme from "@app/rne-theme/theme"

type TextStyleFactory = (
  props: TextProps,
  theme: { colors: typeof light },
) => { style: Record<string, unknown> }

const textStyle = (props: TextProps) =>
  (theme.components?.Text as unknown as TextStyleFactory)(props, { colors: light }).style

describe("theme Text", () => {
  const types = ["h1", "h2", "p1", "p2", "p3", "p4"] as const
  types.forEach((type) => {
    it(`renders bold ${type} with the 700 bold face and no weight of its own`, () => {
      const style = textStyle({ type, bold: true })

      expect(style.fontFamily).toBe(fonts.bold)
      expect(style.fontWeight).toBeUndefined()
    })
  })

  it("renders bold without a type with the bold face", () => {
    expect(textStyle({ bold: true }).fontFamily).toBe(fonts.bold)
  })

  it("renders text that is not bold with the regular face", () => {
    const style = textStyle({ type: "p2" })

    expect(style.fontFamily).toBe(fonts.regular)
    expect(style.fontWeight).toBeUndefined()
  })
})
