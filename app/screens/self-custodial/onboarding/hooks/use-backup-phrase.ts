import { useCallback, useMemo, useRef, useState } from "react"

import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { useClipboard, useCountdown } from "@app/hooks"
import { useI18nContext } from "@app/i18n/i18n-react"
import { PhraseStep, RootStackParamList } from "@app/navigation/stack-param-lists"
import { splitWords } from "@app/utils/bip39-wordlist"
import { formatDuration } from "@app/utils/date"

import { buildConfirmChallenges } from "../utils"

import { useWalletMnemonic } from "./use-wallet-mnemonic"

const WORDS_PER_STEP = 6
const WORDS_PER_CARD = 3
const COUNTDOWN_SECONDS = 10
const CLIPBOARD_CLEAR_MS = 60_000

/** When the look at step 1's words ends, fixed by the first call rather than on
 *  creation. The screen holds it above its screen-security gate, which mounts the
 *  words again each time it re-activates, so the countdown resumes from the first
 *  time they showed instead of starting over. */
export const useBackupCountdownDeadline = (): (() => Date) => {
  const deadline = useRef<Date | undefined>(undefined)
  return useCallback(() => {
    deadline.current ??= new Date(Date.now() + COUNTDOWN_SECONDS * 1000)
    return deadline.current
  }, [])
}

export const useBackupPhrase = (step: PhraseStep, getCountdownDeadline: () => Date) => {
  const { LL, locale } = useI18nContext()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const { copyToClipboard } = useClipboard(CLIPBOARD_CLEAR_MS)
  const mnemonic = useWalletMnemonic()
  const words = useMemo(() => (mnemonic ? splitWords(mnemonic) : []), [mnemonic])

  const [expiresAt] = useState(getCountdownDeadline)
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
      message: LL.BackupScreen.ManualBackup.Phrase.copiedToast(),
    })
  }, [copyToClipboard, LL, words])

  const handleContinue = useCallback(() => {
    if (isStep1) {
      navigation.navigate("selfCustodialBackupPhrase", { step: PhraseStep.Second })
      return
    }
    const challenges = buildConfirmChallenges(words, 3)
    navigation.navigate("selfCustodialBackupPhraseConfirm", { challenges })
  }, [isStep1, navigation, words])

  const buttonTitle = (() => {
    if (isStep1) {
      if (remainingSeconds)
        return `${LL.BackupScreen.ManualBackup.Phrase.saveItNow()} ${formatDuration(remainingSeconds, { unit: "second", locale })}`
      return LL.BackupScreen.ManualBackup.Phrase.continueButton()
    }
    return LL.BackupScreen.ManualBackup.Phrase.savedConfirm()
  })()

  const isButtonDisabled = isStep1 && !isExpired

  return {
    firstCard,
    secondCard,
    offset,
    handleCopy,
    handleContinue,
    buttonTitle,
    isButtonDisabled,
  }
}
