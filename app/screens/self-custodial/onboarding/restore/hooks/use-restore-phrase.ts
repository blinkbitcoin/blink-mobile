import { useCallback, useMemo, useState } from "react"

import Clipboard from "@react-native-clipboard/clipboard"
import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import { validateMnemonic } from "bip39"

import { useBip39Input } from "@app/hooks/use-bip39-input"
import { useI18nContext } from "@app/i18n/i18n-react"
import { PhraseStep, RootStackParamList } from "@app/navigation/stack-param-lists"
import { splitWords } from "@app/utils/bip39-wordlist"

import { RestoreWalletStatus, useRestoreWallet } from "./use-restore-wallet"

const WORD_COUNT = 12
const WORDS_PER_STEP = 6

type RestorePhraseParams = {
  step: PhraseStep
  initialWords?: string[]
}

export const useRestorePhrase = ({ step, initialWords }: RestorePhraseParams) => {
  const { LL } = useI18nContext()
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()
  const { restore, status: restoreStatus } = useRestoreWallet()
  const [validationError, setValidationError] = useState<string | null>(null)

  const isStep1 = step === PhraseStep.First

  const bip39 = useBip39Input({
    wordCount: WORD_COUNT,
    wordsPerStep: WORDS_PER_STEP,
    step,
    initialWords,
  })

  const handlePaste = useCallback(
    (text: string) => {
      const accepted = bip39.handlePaste(text)
      if (!accepted || !isStep1) return accepted

      const parsed = splitWords(text)
      if (parsed.length === WORD_COUNT && validateMnemonic(parsed.join(" "))) {
        navigation.navigate("sparkRestorePhraseScreen", {
          step: PhraseStep.Second,
          words: parsed,
        })
      }
      return accepted
    },
    [bip39, isStep1, navigation],
  )

  const handlePasteFromClipboard = useCallback(async () => {
    const text = await Clipboard.getString()
    if (text) handlePaste(text)
  }, [handlePaste])

  const isValid = useMemo(() => {
    if (!bip39.allFilled) return false
    return validateMnemonic(bip39.words.join(" "))
  }, [bip39.words, bip39.allFilled])

  const handleContinue = useCallback(() => {
    navigation.navigate("sparkRestorePhraseScreen", {
      step: PhraseStep.Second,
      words: bip39.words,
    })
  }, [navigation, bip39.words])

  const handleRestore = useCallback(async () => {
    const mnemonic = bip39.words.join(" ")
    if (!validateMnemonic(mnemonic)) {
      setValidationError(LL.RestoreScreen.invalidMnemonic())
      return
    }
    await restore(mnemonic).catch(() => {})
  }, [bip39.words, restore, LL])

  const updateWord = useCallback(
    (index: number, value: string) => {
      bip39.updateWord(index, value)
      setValidationError(null)
    },
    [bip39],
  )

  return {
    words: bip39.words,
    stepWords: bip39.stepWords,
    offset: bip39.offset,
    activeIndex: bip39.activeIndex,
    setActiveIndex: bip39.setActiveIndex,
    suggestions: bip39.suggestions,
    selectSuggestion: bip39.selectSuggestion,
    handlePaste,
    stepFilled: bip39.stepFilled,
    allFilled: bip39.allFilled,
    focusRequest: bip39.focusRequest,
    clearFocusRequest: bip39.clearFocusRequest,
    updateWord,
    handlePasteFromClipboard,
    isValid,
    validationError,
    status: restoreStatus,
    isStep1,
    handleContinue,
    handleRestore,
  }
}

export { RestoreWalletStatus as RestoreStatus }
