import { Platform } from "react-native"

import { TranslationFunctions } from "@app/i18n/i18n-types"
import { pickRandomIndices } from "@app/utils/helper"

export const getCloudProviderName = (LL: TranslationFunctions): string =>
  Platform.OS === "ios"
    ? LL.BackupScreen.BackupMethod.appleICloud()
    : LL.BackupScreen.BackupMethod.googleDrive()

export const MNEMONIC_WORD_COUNT = 12
export const WORDS_PER_STEP = 6

export type Challenge = { index: number; word: string }

export const buildConfirmChallenges = (
  words: readonly string[],
  count: number,
): Challenge[] => {
  const indices = pickRandomIndices(words.length, count)
  return indices.map((i) => ({ index: i, word: words[i] }))
}

/** Route params can arrive malformed (#4070), so the phrase screens validate them before
 *  trusting them. Shape alone is not enough: a challenge whose index falls outside the
 *  mnemonic, repeats, or carries an empty word renders a prompt the user cannot answer,
 *  which is the same dead end as no challenges at all (#4088 review, I2). */
export const isValidChallenges = (value: unknown): value is Challenge[] =>
  Array.isArray(value) &&
  value.length > 0 &&
  value.every(
    (challenge: Partial<Challenge> | undefined) =>
      Number.isInteger(challenge?.index) &&
      Number(challenge?.index) >= 0 &&
      Number(challenge?.index) < MNEMONIC_WORD_COUNT &&
      typeof challenge?.word === "string" &&
      challenge.word.trim().length > 0,
  ) &&
  new Set(value.map((challenge: Challenge) => challenge.index)).size === value.length

/** Restore step 2 renders only inputs 7-12, so it is unusable unless all 12 slots arrived
 *  and the first 6 hold the words entered on step 1 — anything less (rehydration
 *  truncating or dropping the array) is invalid params, not a state to seed. */
export const isValidStepTwoWords = (value: unknown): value is string[] =>
  Array.isArray(value) &&
  value.length === MNEMONIC_WORD_COUNT &&
  value.every((word) => typeof word === "string") &&
  value.slice(0, WORDS_PER_STEP).every((word) => word.trim().length > 0)
