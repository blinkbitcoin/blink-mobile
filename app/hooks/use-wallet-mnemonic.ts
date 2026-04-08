// TODO: Replace with real wallet mnemonic from Spark SDK (KeyStoreWrapper.getMnemonic)
// This hook currently returns mock data for development. Must not ship to production.

import { MOCK_WORDS } from "@app/screens/spark-onboarding/spark-mock-data"

export const useWalletMnemonic = (): string => {
  if (__DEV__) return MOCK_WORDS.join(" ")
  throw new Error("useWalletMnemonic: real mnemonic not yet wired")
}

export const useWalletMnemonicWords = (): readonly string[] => {
  if (__DEV__) return MOCK_WORDS
  throw new Error("useWalletMnemonicWords: real mnemonic not yet wired")
}
