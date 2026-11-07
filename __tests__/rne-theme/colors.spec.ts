import { dark, light } from "@app/rne-theme/colors"

/** The values design approved for blink-wip#1871. A revert of the palette
 *  must fail here even when the derived expectations change with it. */
describe("palette contract", () => {
  it("paints static surfaces with the approved grey7", () => {
    expect(light.grey7).toBe("#F7F7F7")
    expect(dark.grey7).toBe("#121212")
  })

  it("keeps the darkened light grey2", () => {
    expect(light.grey2).toBe("#8C8C97")
  })
})
