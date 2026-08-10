import { Platform } from "react-native"

import {
  buildConfirmChallenges,
  getCloudProviderName,
  isValidChallenges,
  isValidStepTwoWords,
  MNEMONIC_WORD_COUNT,
  WORDS_PER_STEP,
} from "@app/screens/self-custodial/onboarding/utils"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { i18nObject } from "@app/i18n/i18n-util"

loadLocale("en")
const LL = i18nObject("en")

const mnemonic = [
  ...["abandon", "ability", "able", "about", "above", "absent"],
  ...["absorb", "abstract", "absurd", "abuse", "access", "accident"],
]

describe("getCloudProviderName", () => {
  it("names iCloud on iOS", () => {
    jest.replaceProperty(Platform, "OS", "ios")
    expect(getCloudProviderName(LL)).toBe(LL.BackupScreen.BackupMethod.appleICloud())
  })

  it("names Google Drive on Android", () => {
    jest.replaceProperty(Platform, "OS", "android")
    expect(getCloudProviderName(LL)).toBe(LL.BackupScreen.BackupMethod.googleDrive())
  })
})

describe("buildConfirmChallenges", () => {
  it("builds the requested number of semantically valid challenges", () => {
    const challenges = buildConfirmChallenges(mnemonic, 3)

    expect(challenges).toHaveLength(3)
    challenges.forEach(({ index, word }) => expect(word).toBe(mnemonic[index]))
    expect(isValidChallenges(challenges)).toBe(true)
  })
})

describe("isValidChallenges", () => {
  it("accepts in-range, unique, non-blank challenges", () => {
    expect(
      isValidChallenges([
        { index: 0, word: "abandon" },
        { index: MNEMONIC_WORD_COUNT - 1, word: "accident" },
      ]),
    ).toBe(true)
  })

  const invalidChallengeCases: Array<[string, unknown]> = [
    ["a non-array", "not-an-array"],
    ["an empty list", []],
    ["a missing entry", [undefined]],
    ["a non-integer index", [{ index: 1.5, word: "abandon" }]],
    ["a negative index", [{ index: -1, word: "abandon" }]],
    ["an index past the mnemonic", [{ index: MNEMONIC_WORD_COUNT, word: "abandon" }]],
    ["a non-string word", [{ index: 1, word: 7 }]],
    ["a blank word", [{ index: 1, word: "  " }]],
    [
      "repeated indexes",
      [
        { index: 1, word: "ability" },
        { index: 1, word: "able" },
      ],
    ],
  ]
  invalidChallengeCases.forEach(([label, value]) => {
    it(`rejects ${label}`, () => {
      expect(isValidChallenges(value)).toBe(false)
    })
  })
})

describe("isValidStepTwoWords", () => {
  it("accepts a full array whose leading words are filled", () => {
    expect(isValidStepTwoWords(mnemonic)).toBe(true)
    expect(
      isValidStepTwoWords([
        ...mnemonic.slice(0, WORDS_PER_STEP),
        ...Array(MNEMONIC_WORD_COUNT - WORDS_PER_STEP).fill(""),
      ]),
    ).toBe(true)
  })

  const invalidWordsCases: Array<[string, unknown]> = [
    ["a non-array", "not-an-array"],
    ["a truncated array", mnemonic.slice(0, 2)],
    ["a non-string member", [...mnemonic.slice(0, 11), 7]],
    [
      "blank leading words",
      [...Array(WORDS_PER_STEP).fill(""), ...mnemonic.slice(WORDS_PER_STEP)],
    ],
  ]
  invalidWordsCases.forEach(([label, value]) => {
    it(`rejects ${label}`, () => {
      expect(isValidStepTwoWords(value)).toBe(false)
    })
  })
})
