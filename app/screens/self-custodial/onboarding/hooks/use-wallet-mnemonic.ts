import { useCallback, useEffect, useMemo, useState } from "react"

import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { useActiveWallet } from "@app/hooks/use-active-wallet"
import { useMigrationCheckpointState } from "@app/screens/account-migration/hooks/use-migration-checkpoint-state"
import { deriveWalletIdentityPubkey } from "@app/self-custodial/bridge"
import { useSparkNetwork } from "@app/self-custodial/hooks/use-spark-network"
import KeyStoreWrapper from "@app/utils/storage/secureStorage"

/**
 * On-demand keychain read for the active backup account's phrase. Screens that must show or
 * save the phrase eagerly use useWalletMnemonic; the method picker uses this so the key
 * material is only pulled into memory once a method is actually chosen.
 */
export const useLoadWalletMnemonic = (): (() => Promise<string>) => {
  const { isSelfCustodial } = useActiveWallet()
  const { activeAccount } = useAccountRegistry()
  const { accountId: migrationAccountId } = useMigrationCheckpointState()

  /** Mid-migration the active account is still custodial, so read the provisioned account. */
  const targetAccountId = isSelfCustodial ? activeAccount?.id ?? null : migrationAccountId

  return useCallback(async () => {
    if (!targetAccountId) return ""
    return (await KeyStoreWrapper.getMnemonicForAccount(targetAccountId)) ?? ""
  }, [targetAccountId])
}

export const useWalletMnemonic = (): string => {
  const [mnemonic, setMnemonic] = useState("")
  const loadMnemonic = useLoadWalletMnemonic()

  useEffect(() => {
    let mounted = true
    loadMnemonic().then((stored) => {
      if (mounted) setMnemonic(stored)
    })
    return () => {
      mounted = false
    }
  }, [loadMnemonic])

  return mnemonic
}

export const useWalletIdentity = (mnemonic: string): string => {
  const network = useSparkNetwork()
  return useMemo(
    () => (mnemonic ? deriveWalletIdentityPubkey(mnemonic, network) : ""),
    [mnemonic, network],
  )
}
