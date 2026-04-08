import { useCallback, useMemo, useRef } from "react"

import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"

import { useRemoteConfig } from "@app/config/feature-flags-context"
import { useClipboard, useCountdown } from "@app/hooks"
import { useWalletMnemonicWords } from "@app/hooks/use-wallet-mnemonic"
import { useI18nContext } from "@app/i18n/i18n-react"
import { PhraseStep, RootStackParamList } from "@app/navigation/stack-param-lists"
import { formatDuration } from "@app/utils/date"
import { openExternalUrl } from "@app/utils/external"

import { buildConfirmChallenges } from "../utils"

const WORDS_PER_STEP = 6
const WORDS_PER_CARD = 3
const COUNTDOWN_SECONDS = 10
const CLIPBOARD_CLEAR_MS = 60_000

export const useBackupPhrase = (step: PhraseStep) => {
  const { LL, locale } = useI18nContext()
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()
  const { copyToClipboard } = useClipboard(CLIPBOARD_CLEAR_MS)
  const { sparkCompatibleWalletsUrl } = useRemoteConfig()
  const words = useWalletMnemonicWords()

  const expiresAt = useRef(new Date(Date.now() + COUNTDOWN_SECONDS * 1000)).current
  const { remainingSeconds, isExpired } = useCountdown(expiresAt)

  const isStep1 = step === PhraseStep.First

  const { firstCard, secondCard, offset } = useMemo(() => {
    const wordOffset = isStep1 ? 0 : WORDS_PER_STEP
    const stepWords = words.slice(wordOffset, wordOffset + WORDS_PER_STEP)
    return {
      firstCard: stepWords.slice(0, WORDS_PER_CARD),
      secondCard: stepWords.slice(WORDS_PER_CARD),
      offset: wordOffset,
    }
  }, [isStep1, words])

  const handleCopy = useCallback(() => {
    copyToClipboard({
      content: words.join(" "),
      message: LL.SparkOnboarding.ManualBackup.Phrase.copiedToast(),
    })
  }, [copyToClipboard, LL, words])

  const handleOpenLink = useCallback(
    () => openExternalUrl(sparkCompatibleWalletsUrl),
    [sparkCompatibleWalletsUrl],
  )

  const handleContinue = useCallback(() => {
    if (isStep1) {
      navigation.navigate("sparkBackupPhraseScreen", { step: PhraseStep.Second })
      return
    }
    const challenges = buildConfirmChallenges(words, 3)
    navigation.navigate("sparkBackupConfirmScreen", { challenges })
  }, [isStep1, navigation, words])

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
