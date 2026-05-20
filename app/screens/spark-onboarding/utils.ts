import { Platform } from "react-native"

import { TranslationFunctions } from "@app/i18n/i18n-types"
import { pickRandomIndices } from "@app/utils/helper"

export const getCloudProviderName = (LL: TranslationFunctions): string =>
  Platform.OS === "ios"
    ? LL.SparkOnboarding.BackupMethod.appleICloud()
    : LL.SparkOnboarding.BackupMethod.googleDrive()

export const buildConfirmChallenges = (
  words: readonly string[],
  count: number,
): Array<{ index: number; word: string }> => {
  const indices = pickRandomIndices(words.length, count)
  return indices.map((i) => ({ index: i, word: words[i] }))
}
