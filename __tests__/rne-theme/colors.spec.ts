import { dark, light } from "@app/rne-theme/colors"

/** The values design approved for blink-wip#1871. A revert of the palette
 *  must fail here even when the derived expectations change with it. */
describe("palette contract", () => {
  it("paints static surfaces with the approved surfaceStatic", () => {
    expect(light.surfaceStatic).toBe("#F7F7F7")
    expect(dark.surfaceStatic).toBe("#121212")
  })

  it("keeps the darkened light textMuted", () => {
    expect(light.textMuted).toBe("#8C8C97")
  })
})
