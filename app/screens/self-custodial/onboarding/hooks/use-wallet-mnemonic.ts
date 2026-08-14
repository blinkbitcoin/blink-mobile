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

type WalletMnemonicState = {
  mnemonic: string
  /** True while the keychain read is in flight. The bare string cannot tell "not read
   *  yet" from "no phrase stored", which is the difference between a silent wait and a
   *  local failure for consumers that gate a CTA on it. */
  loading: boolean
}

export const useWalletMnemonicState = (): WalletMnemonicState => {
  /** Two primitives rather than one object, so re-reading the same account settles into
   *  React's bail-out instead of re-rendering every consumer. */
  const [mnemonic, setMnemonic] = useState("")
  const [loading, setLoading] = useState(true)
  const loadMnemonic = useLoadWalletMnemonic()

  useEffect(() => {
    let mounted = true
    setLoading(true)
    loadMnemonic()
      .catch(() => "")
      .then((stored) => {
        if (!mounted) return
        setMnemonic(stored)
        setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [loadMnemonic])

  return useMemo(() => ({ mnemonic, loading }), [mnemonic, loading])
}

export const useWalletMnemonic = (): string => useWalletMnemonicState().mnemonic

type WalletIdentity = {
  pubkey: string
  /** True while derivation is in flight; consumers must not treat the transient empty
   *  pubkey as a failure until this settles. */
  loading: boolean
}

export const useWalletIdentity = (mnemonic: string): WalletIdentity => {
  const network = useSparkNetwork()
  const [pubkey, setPubkey] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!mnemonic) {
      setPubkey("")
      setLoading(false)
      return
    }
    let mounted = true
    setLoading(true)
    deriveWalletIdentityPubkey(mnemonic, network)
      .catch(() => "")
      .then((derived) => {
        if (!mounted) return
        setPubkey(derived)
        setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [mnemonic, network])

  return { pubkey, loading }
}
