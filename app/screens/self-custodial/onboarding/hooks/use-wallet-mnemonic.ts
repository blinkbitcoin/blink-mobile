import { useCallback, useEffect, useMemo, useState } from "react"

import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { useMigrationCheckpointState } from "@app/screens/account-migration/hooks/use-migration-checkpoint-state"
import { deriveWalletIdentityPubkey } from "@app/self-custodial/bridge"
import { useSparkNetwork } from "@app/self-custodial/hooks/use-spark-network"
import { AccountType } from "@app/types/wallet"
import { reportError } from "@app/utils/error-logging"
import KeyStoreWrapper from "@app/utils/storage/secureStorage"

/**
 * The account a backup flow is acting on. Mid-migration the active account is
 * still the custodial one while the phrase, the identity and the recovery
 * bundle all belong to the provisioned self-custodial account, so every step of
 * those flows has to agree on this one answer - reading one account and writing
 * another is how an opt-in gets recorded where nothing will ever look for it.
 */
export const useBackupTargetAccountId = (): string | null => {
  const { activeAccount } = useAccountRegistry()
  const { accountId: migrationAccountId } = useMigrationCheckpointState()

  /** Account type, not useActiveWallet().isSelfCustodial: that also encodes SDK
   *  availability, so it reads false on the initial renders at cold start and
   *  right after an account switch. Falling through to the migration id there
   *  would drop the target for a self-custodial user whose SDK is merely still
   *  starting. */
  const isActiveAccountSelfCustodial = activeAccount?.type === AccountType.SelfCustodial
  if (isActiveAccountSelfCustodial) return activeAccount.id

  return migrationAccountId
}

/**
 * On-demand keychain read for the active backup account's phrase. Screens that must show or
 * save the phrase eagerly use useWalletMnemonic; the method picker uses this so the key
 * material is only pulled into memory once a method is actually chosen.
 */
export const useLoadWalletMnemonic = (): (() => Promise<string>) => {
  const targetAccountId = useBackupTargetAccountId()

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
      /** Defensive only: KeyStoreWrapper.getMnemonicForAccount already swallows a keychain
       *  failure to null, so this promise has no reachable rejection to report. */
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
  /** The pubkey is kept next to the phrase it was derived from so that "settled" is computed
   *  from the current phrase rather than stored by an effect that runs one render too late.
   *  A stored flag still reads false on the render the phrase changes, which hands consumers
   *  the previous wallet's pubkey as if it were the current one. */
  const [derived, setDerived] = useState({ forMnemonic: "", pubkey: "" })

  useEffect(() => {
    if (!mnemonic) return
    let mounted = true
    deriveWalletIdentityPubkey(mnemonic, network)
      .catch((err) => {
        reportError("deriveWalletIdentityPubkey", err)
        return ""
      })
      .then((pubkey) => {
        if (mounted) setDerived({ forMnemonic: mnemonic, pubkey })
      })
    return () => {
      mounted = false
    }
  }, [mnemonic, network])

  const isSettled = derived.forMnemonic === mnemonic

  return useMemo(
    () => ({
      pubkey: isSettled ? derived.pubkey : "",
      loading: Boolean(mnemonic) && !isSettled,
    }),
    [mnemonic, isSettled, derived.pubkey],
  )
}
