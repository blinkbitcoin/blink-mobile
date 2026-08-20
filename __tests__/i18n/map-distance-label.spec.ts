import fs from "fs"
import path from "path"

const TRANSLATIONS_DIR = path.resolve(
  __dirname,
  "..",
  "..",
  "app",
  "i18n",
  "raw-i18n",
  "translations",
)

const PLACEHOLDER = "{distance: string}"

const localeFiles = fs
  .readdirSync(TRANSLATIONS_DIR)
  .filter((name) => name.endsWith(".json"))
  .sort()

type MapScreenCopy = { metersAway: string; kilometersAway: string }

describe("map distance labels", () => {
  localeFiles.forEach((localeFile) => {
    it(`still carries the distance itself in ${localeFile}`, () => {
      // The number is the whole point of the row, and losing the placeholder in
      // translation loses it silently: the string still renders, just without
      // the distance in it.
      const parsed = JSON.parse(
        fs.readFileSync(path.join(TRANSLATIONS_DIR, localeFile), "utf8"),
      ) as { MapScreen: MapScreenCopy }

      expect(parsed.MapScreen.metersAway).toContain(PLACEHOLDER)
      expect(parsed.MapScreen.kilometersAway).toContain(PLACEHOLDER)
    })
  })
})
