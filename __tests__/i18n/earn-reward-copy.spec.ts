import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"

/**
 * The `sats` formatter writes "1 sat" for one and "N sats" otherwise, and quiz rewards of
 * a single sat are real. A translation that agrees a verb or participle with a plural
 * subject ("1 sat ganhos") reads wrong on exactly that path, and key parity cannot see it.
 * Each string here is asserted at one sat and at a plural amount.
 */
const EXPECTED = {
  pt: {
    earnSats: ["Ganhe 1 sat", "Ganhe 21 sats"],
    satsEarned: ["Você ganhou 1 sat", "Você ganhou 21 sats"],
    quizComplete: [
      "Quiz concluído e você ganhou 1 sat",
      "Quiz concluído e você ganhou 21 sats",
    ],
  },
  el: {
    earnSats: ["Κερδίστε 1 sat", "Κερδίστε 21 sats"],
    satsEarned: ["1 sat που κερδίσατε", "21 sats που κερδίσατε"],
  },
} as const

describe("Earn reward copy at one sat and at many", () => {
  for (const [locale, keys] of Object.entries(EXPECTED)) {
    describe(locale, () => {
      loadLocale(locale as "pt" | "el")
      const { EarnScreen } = i18nObject(locale as "pt" | "el")

      for (const [key, [one, many]] of Object.entries(keys)) {
        it(`${key} agrees with a single sat and with a plural amount`, () => {
          const render = EarnScreen[key as keyof typeof keys]
          expect(render({ formattedNumber: 1 })).toBe(one)
          expect(render({ formattedNumber: 21 })).toBe(many)
        })
      }
    })
  }
})
