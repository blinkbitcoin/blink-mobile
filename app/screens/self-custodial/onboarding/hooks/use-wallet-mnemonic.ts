import { useEffect, useMemo, useState } from "react"

import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { useActiveWallet } from "@app/hooks/use-active-wallet"
import { useMigrationCheckpoint } from "@app/screens/account-migration/hooks/use-migration-checkpoint"
import { deriveWalletIdentityPubkey } from "@app/self-custodial/bridge"
import { useSparkNetwork } from "@app/self-custodial/hooks/use-spark-network"
import KeyStoreWrapper from "@app/utils/storage/secureStorage"

export const useWalletMnemonic = (): string => {
  const [mnemonic, setMnemonic] = useState("")
  const { isSelfCustodial } = useActiveWallet()
  const { activeAccount } = useAccountRegistry()
  const { accountId: migrationAccountId } = useMigrationCheckpoint()

  /** Mid-migration the active account is still custodial, so read the provisioned account. */
  const targetAccountId = isSelfCustodial ? activeAccount?.id ?? null : migrationAccountId

  useEffect(() => {
    if (!targetAccountId) {
      setMnemonic("")
      return
    }
    let mounted = true
    KeyStoreWrapper.getMnemonicForAccount(targetAccountId).then((stored) => {
      if (mounted && stored) setMnemonic(stored)
    })
    return () => {
      mounted = false
    }
  }, [targetAccountId])

  return mnemonic
}

export const useWalletIdentity = (mnemonic: string): string => {
  const network = useSparkNetwork()
  return useMemo(
    () => (mnemonic ? deriveWalletIdentityPubkey(mnemonic, network) : ""),
    [mnemonic, network],
  )
}
