import { useCallback, useMemo } from "react"

import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { useClipboard } from "@app/hooks"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { splitWords } from "@app/utils/bip39-wordlist"

import { useWalletMnemonic } from "./use-wallet-mnemonic"

import { buildConfirmChallenges } from "../utils"

const CLIPBOARD_CLEAR_MS = 60_000
const CHALLENGE_COUNT = 3

export const useViewBackupPhrase = () => {
  const { LL } = useI18nContext()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const { copyToClipboard } = useClipboard(CLIPBOARD_CLEAR_MS)
  const mnemonic = useWalletMnemonic()
  const words = useMemo(() => (mnemonic ? splitWords(mnemonic) : []), [mnemonic])

  const handleCopy = useCallback(() => {
    copyToClipboard({
      content: words.join(" "),
      message: LL.BackupScreen.ManualBackup.Phrase.copiedToast(),
    })
  }, [copyToClipboard, LL, words])

  const handleTestBackup = useCallback(() => {
    const challenges = buildConfirmChallenges(words, CHALLENGE_COUNT)
    navigation.navigate("selfCustodialBackupPhraseConfirm", {
      challenges,
      successMessage: LL.BackupScreen.ManualBackup.Success.testSuccess(),
    })
  }, [navigation, words, LL])

  return {
    words,
    handleCopy,
    handleTestBackup,
  }
}
