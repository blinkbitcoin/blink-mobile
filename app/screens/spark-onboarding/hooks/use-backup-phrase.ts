import { useCallback, useMemo, useRef } from "react"
import { Linking } from "react-native"

import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import InAppBrowser from "react-native-inappbrowser-reborn"

import { useRemoteConfig } from "@app/config/feature-flags-context"
import { useClipboard, useCountdown } from "@app/hooks"
import { useI18nContext } from "@app/i18n/i18n-react"
import { PhraseStep, RootStackParamList } from "@app/navigation/stack-param-lists"
import { formatDuration } from "@app/utils/date"
import { pickRandomIndices } from "@app/utils/helper"

import { MOCK_WORDS } from "../spark-mock-data"

const WORDS_PER_STEP = 6
const WORDS_PER_CARD = 3
const COUNTDOWN_SECONDS = 10
const CLIPBOARD_CLEAR_MS = 60_000

export const useBackupPhrase = (step: PhraseStep) => {
  const { LL, locale } = useI18nContext()
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()
  const { copyToClipboard } = useClipboard(CLIPBOARD_CLEAR_MS)
  const { sparkCompatibleWalletsUrl } = useRemoteConfig()

  const expiresAt = useRef(new Date(Date.now() + COUNTDOWN_SECONDS * 1000)).current
  const { remainingSeconds, isExpired } = useCountdown(expiresAt)

  const isStep1 = step === PhraseStep.First

  const { firstCard, secondCard, offset } = useMemo(() => {
    const wordOffset = isStep1 ? 0 : WORDS_PER_STEP
    const stepWords = MOCK_WORDS.slice(wordOffset, wordOffset + WORDS_PER_STEP)
    return {
      firstCard: stepWords.slice(0, WORDS_PER_CARD),
      secondCard: stepWords.slice(WORDS_PER_CARD),
      offset: wordOffset,
    }
  }, [isStep1])

  const handleCopy = useCallback(() => {
    copyToClipboard({
      content: MOCK_WORDS.join(" "),
      message: LL.SparkOnboarding.ManualBackup.Phrase.copiedToast(),
    })
  }, [copyToClipboard, LL])

  const handleOpenLink = useCallback(
    () =>
      InAppBrowser.open(sparkCompatibleWalletsUrl).catch(() =>
        Linking.openURL(sparkCompatibleWalletsUrl),
      ),
    [sparkCompatibleWalletsUrl],
  )

  const handleContinue = useCallback(() => {
    if (isStep1) {
      navigation.navigate("sparkBackupPhraseScreen", { step: PhraseStep.Second })
      return
    }
    const indices = pickRandomIndices(MOCK_WORDS.length, 3)
    const challenges = indices.map((i) => ({ index: i, word: MOCK_WORDS[i] }))
    navigation.navigate("sparkBackupConfirmScreen", { challenges })
  }, [isStep1, navigation])

  const buttonTitle = (() => {
    if (isStep1) {
      if (remainingSeconds)
        return `${LL.SparkOnboarding.ManualBackup.Phrase.saveItNow()} ${formatDuration(remainingSeconds, { unit: "second", locale })}`
      return LL.SparkOnboarding.ManualBackup.Phrase.continueButton()
    }
    return LL.SparkOnboarding.ManualBackup.Phrase.savedConfirm()
  })()

  const isButtonDisabled = isStep1 && !isExpired

  return {
    firstCard,
    secondCard,
    offset,
    handleCopy,
    handleOpenLink,
    handleContinue,
    buttonTitle,
    isButtonDisabled,
  }
}
