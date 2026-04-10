import { useEffect, useState } from "react"

import KeyStoreWrapper from "@app/utils/storage/secureStorage"

export const useWalletMnemonic = (): string => {
  const [mnemonic, setMnemonic] = useState("")

  useEffect(() => {
    let mounted = true
    KeyStoreWrapper.getMnemonic().then((stored) => {
      if (mounted && stored) setMnemonic(stored)
    })
    return () => {
      mounted = false
    }
  }, [])

  return mnemonic
}

export const useWalletMnemonicWords = (): readonly string[] => {
  const mnemonic = useWalletMnemonic()
  if (!mnemonic) return []
  return mnemonic.split(" ")
}
