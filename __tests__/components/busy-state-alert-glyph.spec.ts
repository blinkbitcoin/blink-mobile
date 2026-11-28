import fs from "fs"
import path from "path"

/**
 * `busy-state-error` tints the alert glyph with `colors.error` through
 * `GaloyIcon`'s `color`, which only reaches fills that come out of the SVG
 * transform as `currentColor`. Jest stubs every `.svg`, so this runs the asset
 * through the app's own transformer (its defaults plus `.svgrrc`) and reads the
 * generated component instead.
 */

// Stand-in for Metro's Babel pass, which runs after SVGR: hand back the JSX.
jest.mock("@react-native/metro-babel-transformer", () => ({
  transform: ({ src }: { src: string }) => src,
}))

type SvgTransformer = {
  transform: (args: { src: string; filename: string; options: object }) => Promise<string>
}
const { transform } = jest.requireActual<SvgTransformer>("react-native-svg-transformer")

const ALERT_SVG = path.join(__dirname, "../../app/assets/icons-redesign/alert.svg")

describe("alert glyph", () => {
  it("leaves every filled path tintable by the icon colour", async () => {
    const component = await transform({
      src: fs.readFileSync(ALERT_SVG, "utf8"),
      filename: ALERT_SVG,
      options: {},
    })

    const fills = [...component.matchAll(/fill="([^"]*)"/g)].map(([, fill]) => fill)

    expect(fills).toContain("currentColor")
    expect(fills.filter((fill) => fill !== "none" && fill !== "currentColor")).toEqual([])
  })
})
