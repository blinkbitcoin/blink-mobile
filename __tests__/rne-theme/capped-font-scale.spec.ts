import { PixelRatio } from "react-native"

import { cappedFontScale, MAX_FONT_SIZE_MULTIPLIER } from "@app/rne-theme/text-scaling"

/**
 * A box measured for the default text stops holding it the moment the OS grows the glyphs
 * inside: the amount loses its top half to a clipped row, a word breaks in two, a chip cuts
 * "Never" to "Nev". Multiplying the measurement by this keeps the proportions the layout
 * was drawn with, and stops where the text stops.
 */
const withFontScale = (scale: number, assert: () => void) => {
  const fontScale = jest.spyOn(PixelRatio, "getFontScale").mockReturnValue(scale)
  try {
    assert()
  } finally {
    fontScale.mockRestore()
  }
}

describe("cappedFontScale", () => {
  it("leaves a box its own size at the default text size", () => {
    withFontScale(1, () => {
      expect(cappedFontScale()).toBe(1)
    })
  })

  /** The point of it: what the layout was drawn with survives, only larger. */
  it("grows a box by as much as the text grew", () => {
    withFontScale(1.2, () => {
      expect(80 * cappedFontScale()).toBeCloseTo(96, 5)
    })
  })

  it("stops growing where the text stops", () => {
    withFontScale(3, () => {
      expect(cappedFontScale()).toBe(MAX_FONT_SIZE_MULTIPLIER)
    })
  })

  /** Right at the ceiling both agree, so nothing jumps as the OS crosses it. */
  it("meets the ceiling exactly", () => {
    withFontScale(MAX_FONT_SIZE_MULTIPLIER, () => {
      expect(cappedFontScale()).toBe(MAX_FONT_SIZE_MULTIPLIER)
    })
  })

  /** A phone set below the default still reports honestly: this caps growth, not shrinking. */
  it("follows a text size smaller than the default", () => {
    withFontScale(0.85, () => {
      expect(cappedFontScale()).toBe(0.85)
    })
  })
})
