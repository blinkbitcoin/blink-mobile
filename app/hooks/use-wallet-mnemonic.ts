import { useEffect, useState } from "react"

import KeyStoreWrapper from "@app/utils/storage/secureStorage"

import { useAccountRegistry } from "./use-account-registry"
import { useActiveWallet } from "./use-active-wallet"

export const useWalletMnemonic = (): string => {
  const [mnemonic, setMnemonic] = useState("")
  const { isSelfCustodial } = useActiveWallet()
  const { activeAccount } = useAccountRegistry()
  const activeSelfCustodialAccountId = (isSelfCustodial && activeAccount?.id) || null

  useEffect(() => {
    if (!activeSelfCustodialAccountId) {
      setMnemonic("")
      return
    }
    let mounted = true
    KeyStoreWrapper.getMnemonicForAccount(activeSelfCustodialAccountId).then((stored) => {
      if (mounted && stored) setMnemonic(stored)
    })
    return () => {
      mounted = false
    }
  }, [activeSelfCustodialAccountId])

  return mnemonic
}

export const useWalletMnemonicWords = (): readonly string[] => {
  const mnemonic = useWalletMnemonic()
  if (!mnemonic) return []
  return mnemonic.split(" ")
}
