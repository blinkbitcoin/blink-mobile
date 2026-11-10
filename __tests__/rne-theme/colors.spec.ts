import { dark, light } from "@app/rne-theme/colors"

/** The values design approved for blink-wip#1871. A revert of the palette
 *  must fail here even when the derived expectations change with it. */
describe("palette contract", () => {
  it("paints static surfaces with the approved surfaceStatic", () => {
    expect(light.surfaceStatic).toBe("#F2F2F2")
    expect(dark.surfaceStatic).toBe("#171717")
  })

  it("keeps the darkened light textMuted", () => {
    expect(light.textMuted).toBe("#8C8C97")
  })

  it("dims behind modals and sheets with a black scrim in both modes", () => {
    expect(light.scrim).toBe("rgba(0, 0, 0, 0.5)")
    expect(dark.scrim).toBe("rgba(0, 0, 0, 0.5)")
  })
})
