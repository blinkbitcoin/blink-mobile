import fs from "fs"
import path from "path"

import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"

const TRANSLATIONS_DIR = path.resolve(
  __dirname,
  "..",
  "..",
  "app",
  "i18n",
  "raw-i18n",
  "translations",
)

/**
 * The keypad states the same number two ways, and only one of them blames the person
 * reading it. `attemptsRemaining` and `oneAttemptRemaining` answer an entry just rejected
 * on this screen; `attemptsLeft` and `oneAttemptLeft` state a count the screen came back
 * to, where nobody typed anything wrong here.
 *
 * Key parity cannot see the difference. Swahili held all four keys with every placeholder
 * intact and still told someone who had just failed that their PIN was right: `sahihi` is
 * "correct", and the plural branch was missing the `si` that negates it, while its own
 * singular branch next door read correctly.
 *
 * What holds across every locale is that the blaming copy is the plain count with the
 * blame put in front of it, so the plain count survives inside it word for word.
 */
const ATTEMPT_COPY_PAIRS = [
  { blamed: "attemptsRemaining", plain: "attemptsLeft" },
  { blamed: "oneAttemptRemaining", plain: "oneAttemptLeft" },
] as const

/**
 * Malay translated the placeholder name itself, so its blaming copy interpolates nothing
 * and cannot contain the plain one. That is a real defect, already recorded as placeholder
 * drift in `locale-parity.spec.ts`; repeating it here would only report it twice.
 */
const KNOWN_PLACEHOLDER_DRIFT = new Set(["ms.json:attemptsRemaining"])

type PinScreenCopy = Record<string, string | undefined>

const readPinScreenCopy = (file: string): PinScreenCopy => {
  const parsed = JSON.parse(fs.readFileSync(path.join(TRANSLATIONS_DIR, file), "utf8"))
  return (parsed as { PinScreen: PinScreenCopy }).PinScreen
}

/** Wording is what this compares, so spacing and case are normalised away: a locale that
 *  differs from the plain count only by a stray space has a typo, not a lost blame. */
const wording = (value: string): string => value.replace(/\s+/g, "").toLowerCase()

const translationFiles = fs
  .readdirSync(TRANSLATIONS_DIR)
  .filter((file) => file.endsWith(".json"))
  .sort()

describe("the PIN keypad's attempt copy", () => {
  describe("Swahili, where the negation was lost", () => {
    beforeAll(() => loadLocale("sw"))

    it("tells a rejected entry it was not correct, in both counts", () => {
      const LL = i18nObject("sw")

      expect(LL.PinScreen.attemptsRemaining({ attemptsRemaining: 2 })).toBe(
        "Pini si sahihi. Majaribio 2 yamesalia.",
      )
      expect(LL.PinScreen.oneAttemptRemaining()).toBe(
        "Pini si sahihi. Jaribio 1 limesalia.",
      )
    })

    it("says nothing about correctness in the counts no entry caused", () => {
      const LL = i18nObject("sw")

      expect(LL.PinScreen.attemptsLeft({ attemptsRemaining: 2 })).toBe(
        "Majaribio 2 yamesalia.",
      )
      expect(LL.PinScreen.oneAttemptLeft()).toBe("Jaribio 1 limesalia.")
      expect(LL.PinScreen.attemptsLeft({ attemptsRemaining: 2 })).not.toContain("sahihi")
      expect(LL.PinScreen.oneAttemptLeft()).not.toContain("sahihi")
    })
  })

  /** Read from the raw files rather than rendered, so a locale whose placeholder name was
   *  translated is still checked for the thing this is about. */
  it("keeps the plain count intact inside the blaming one, in every locale", () => {
    const offenders: string[] = []

    for (const file of translationFiles) {
      const copy = readPinScreenCopy(file)
      const checkedPairs = ATTEMPT_COPY_PAIRS.filter(
        ({ blamed }) => !KNOWN_PLACEHOLDER_DRIFT.has(`${file}:${blamed}`),
      )

      for (const { blamed, plain } of checkedPairs) {
        const blamedCopy = copy[blamed]
        const plainCopy = copy[plain]
        /** A key this spec cannot read is one `locale-parity.spec.ts` already reports as
         *  missing, so it fails here as the same thing rather than a second message. */
        const isPlainCountKept =
          blamedCopy !== undefined &&
          plainCopy !== undefined &&
          wording(blamedCopy).includes(wording(plainCopy))

        if (!isPlainCountKept) {
          offenders.push(`${file}:${blamed} does not keep ${plain} intact`)
        }
      }
    }

    expect(offenders).toEqual([])
  })
})
