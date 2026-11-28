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

// The card is called the Blink Card wherever a string names it. "Visa" only describes
// its kind or its network: the network label, the card types, and the line that says
// it is a Visa card.
const KIND_KEYS = [
  "CardFlow.networkVisa",
  "CardFlow.CardDetails.cardTypeVirtual",
  "CardFlow.CardDetails.cardTypePhysical",
  "CardFlow.Onboarding.CardDetails.features.card.subtitle",
]

// The strings that name the card itself, checked in every language.
const CARD_NAME_KEYS = [
  "CardFlow.CardDashboard.title",
  "CardFlow.CardStatus.title",
  "CardFlow.CardStatus.CardApproved.subtitle",
  "CardFlow.PersonalDetails.blinkCardholder",
  "CardFlow.AddToMobileWallet.addYourCardDescription",
  "CardFlow.CardSettings.closeCardAccountDescription",
  "CardFlow.CardSettings.closeCardWarning",
  "CardFlow.CardSettings.closeCardSuccessSubtitle",
]

// Visa as the Latin, Arabic and Cyrillic scripts of these files write it.
const VISA = /visa|فيزا|виза/i

type AnyTranslation = Record<string, unknown>

const collectKeysMatching = (node: unknown, pattern: RegExp, prefix = ""): string[] => {
  if (typeof node === "string") return pattern.test(node) ? [prefix] : []
  if (node === null || typeof node !== "object") return []
  const obj = node as AnyTranslation
  return Object.keys(obj).flatMap((key) =>
    collectKeysMatching(obj[key], pattern, prefix ? `${prefix}.${key}` : key),
  )
}

const valueAt = (node: AnyTranslation, key: string): unknown =>
  key.split(".").reduce<unknown>((at, part) => (at as AnyTranslation)?.[part], node)

const localeFiles = fs
  .readdirSync(TRANSLATIONS_DIR)
  .filter((name) => name.endsWith(".json"))
  .sort()

describe("the card's name", () => {
  it("is never Visa in the English source, beyond the kind of card", () => {
    const namingVisa = collectKeysMatching(en, /visa/i).filter(
      (key) => !KIND_KEYS.includes(key),
    )

    expect(namingVisa).toEqual([])
  })

  localeFiles.forEach((localeFile) => {
    const parsed = JSON.parse(
      fs.readFileSync(path.join(TRANSLATIONS_DIR, localeFile), "utf8"),
    ) as AnyTranslation

    it(`never reads Blink Visa in ${localeFile}`, () => {
      expect(collectKeysMatching(parsed, /blink[\s-]*visa/i)).toEqual([])
    })

    it(`is Blink, not Visa, wherever ${localeFile} names the card`, () => {
      CARD_NAME_KEYS.forEach((key) => {
        const value = String(valueAt(parsed, key))

        expect({ key, value, namesBlink: value.includes("Blink") }).toMatchObject({
          namesBlink: true,
        })
        expect({ key, value, namesVisa: VISA.test(value) }).toMatchObject({
          namesVisa: false,
        })
      })
    })
  })
})
