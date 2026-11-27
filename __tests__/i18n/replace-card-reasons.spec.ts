import fs from "fs"
import path from "path"

import en from "@app/i18n/en"

const TRANSLATIONS_DIR = path.resolve(
  __dirname,
  "..",
  "..",
  "app",
  "i18n",
  "raw-i18n",
  "translations",
)

type ReportIssueCopy = {
  lostCardDescription: string
  stolenCardDescription: string
  damagedCardDescription: string
}

type Translation = { CardFlow: { ReplaceCard: { ReportIssue: ReportIssueCopy } } }

const descriptionsOf = (copy: ReportIssueCopy) => [
  copy.lostCardDescription,
  copy.stolenCardDescription,
  copy.damagedCardDescription,
]

const localeFiles = fs
  .readdirSync(TRANSLATIONS_DIR)
  .filter((name) => name.endsWith(".json"))
  .sort()

/** A lost, a stolen and a damaged card are told apart by their own descriptions; the
 *  design repeats one line for the three (DS6). */
describe("the replacement's reasons", () => {
  it("each have their own description in the English source", () => {
    const source = en as unknown as Translation
    const descriptions = descriptionsOf(source.CardFlow.ReplaceCard.ReportIssue)

    expect(new Set(descriptions).size).toBe(3)
  })

  localeFiles.forEach((localeFile) => {
    it(`each have their own description in ${localeFile}`, () => {
      const parsed = JSON.parse(
        fs.readFileSync(path.join(TRANSLATIONS_DIR, localeFile), "utf8"),
      ) as Translation

      const descriptions = descriptionsOf(parsed.CardFlow.ReplaceCard.ReportIssue)

      expect(new Set(descriptions).size).toBe(3)
    })
  })
})
