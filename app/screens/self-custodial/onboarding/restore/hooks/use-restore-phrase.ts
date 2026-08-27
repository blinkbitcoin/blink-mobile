import { useCallback, useMemo, useState } from "react"

import Clipboard from "@react-native-clipboard/clipboard"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { validateMnemonic } from "bip39"

import { useBip39Input } from "@app/hooks/use-bip39-input"
import { useI18nContext } from "@app/i18n/i18n-react"
import { PhraseStep, RootStackParamList } from "@app/navigation/stack-param-lists"
import { splitWords } from "@app/utils/bip39-wordlist"
import { reportError } from "@app/utils/error-logging"
import { toastShow } from "@app/utils/toast"

import { useMigrationAccount } from "@app/screens/account-migration/hooks"

import { MNEMONIC_WORD_COUNT, WORDS_PER_STEP } from "../../utils"
import { RestoreWalletStatus, useRestoreWallet } from "./use-restore-wallet"

type RestorePhraseParams = {
  step: PhraseStep
  initialWords?: string[]
  /** Absent means onboarding restore, which activates the wallet at once. "migration"
   *  hands the phrase to the migration flow instead, which must leave the custodial
   *  account active until it commits. */
  flow?: "migration"
}

export const useRestorePhrase = ({ step, initialWords, flow }: RestorePhraseParams) => {
  const { LL } = useI18nContext()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const { restore, status: restoreStatus } = useRestoreWallet()
  const {
    importAccount,
    isProvisioning,
    loading: migrationLoading,
  } = useMigrationAccount()
  const isMigrationFlow = flow === "migration"
  const [validationError, setValidationError] = useState<string | null>(null)

  const isStep1 = step === PhraseStep.First

  const bip39 = useBip39Input({
    wordCount: MNEMONIC_WORD_COUNT,
    wordsPerStep: WORDS_PER_STEP,
    step,
    initialWords,
  })

  const handlePaste = useCallback(
    (text: string) => {
      const accepted = bip39.handlePaste(text)
      if (!accepted || !isStep1) return accepted

      const parsed = splitWords(text)
      if (parsed.length === MNEMONIC_WORD_COUNT && validateMnemonic(parsed.join(" "))) {
        navigation.navigate("selfCustodialRestorePhrase", {
          step: PhraseStep.Second,
          words: parsed,
          flow,
        })
      }
      return accepted
    },
    [bip39, isStep1, navigation, flow],
  )

  /** Wired to a header onPress, so a clipboard rejection would surface as an unhandled
   *  promise rejection; report and toast it instead, and let the user type manually. */
  const handlePasteFromClipboard = useCallback(async () => {
    try {
      const text = await Clipboard.getString()
      if (text) handlePaste(text)
    } catch (err) {
      reportError("Restore phrase clipboard read", err)
      toastShow({ message: LL.RestoreScreen.pasteFailed(), LL })
    }
  }, [handlePaste, LL])

  const isValid = useMemo(() => {
    if (!bip39.allFilled) return false
    return validateMnemonic(bip39.words.join(" "))
  }, [bip39.words, bip39.allFilled])

  const handleContinue = useCallback(() => {
    navigation.navigate("selfCustodialRestorePhrase", {
      step: PhraseStep.Second,
      words: bip39.words,
      flow,
    })
  }, [navigation, bip39.words, flow])

  const handleRestore = useCallback(async () => {
    const mnemonic = bip39.words.join(" ")
    if (!validateMnemonic(mnemonic)) {
      setValidationError(LL.RestoreScreen.invalidMnemonic())
      return
    }
    if (isMigrationFlow) {
      /** The owner id is still being read, and savePendingAccount throws without it. Going
       *  ahead would derive and register the wallet, fail the checkpoint, and leave the
       *  user a generic error plus a new account and zero migration progress. */
      if (migrationLoading) return
      /** importAccount reports its own failures and answers null, so a failed import
       *  leaves the user on this screen with the phrase they typed still in hand. */
      const importedAccountId = await importAccount(mnemonic)
      if (importedAccountId) {
        navigation.navigate("acceptTermsAndConditions", { flow: "migration" })
      }
      return
    }
    await restore(mnemonic).catch(() => {})
  }, [
    bip39.words,
    restore,
    LL,
    isMigrationFlow,
    migrationLoading,
    importAccount,
    navigation,
  ])

  const updateWord = useCallback(
    (index: number, value: string) => {
      bip39.updateWord(index, value)
      setValidationError(null)
    },
    [bip39],
  )

  /** The screen only speaks RestoreWalletStatus, so the migration import reports its
   *  in-flight state through the same vocabulary instead of adding a second flag. The owner
   *  query is deliberately NOT folded in: it resolves on mount, and reporting it here would
   *  cover an empty phrase form with the full-page restoring spinner. */
  const isImporting = isMigrationFlow && isProvisioning
  const status = isImporting ? RestoreWalletStatus.Restoring : restoreStatus

  /** handleRestore refuses while the owner is still being read, so the button has to say
   *  so. Kept apart from isValid, which also drives the invalid-phrase message and the
   *  per-word correctness marks — a phrase in flight is not a phrase that is wrong. */
  const isSubmitBlocked = isMigrationFlow && migrationLoading

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
    isSubmitBlocked,
    validationError,
    status,
    isStep1,
    handleContinue,
    handleRestore,
  }
}

export { RestoreWalletStatus as RestoreStatus }
