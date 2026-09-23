import { useCallback } from "react"
import { validateMnemonic } from "bip39"
import Crypto from "react-native-quick-crypto"

import { useRemoteConfig } from "@app/config/feature-flags-context"
import { AccountMode } from "@app/types/account"
import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { selfCustodialRestoreWallet } from "@app/self-custodial/bridge"
import { useSparkNetwork } from "@app/self-custodial/hooks/use-spark-network"
import {
  StorageReadStatus,
  findSelfCustodialAccountByMnemonic,
} from "@app/self-custodial/storage/account-index"
import { normalizeMnemonic } from "@app/utils/mnemonic"

export const ImportWalletError = {
  InvalidMnemonic: "invalid-mnemonic",
  LookupFailed: "lookup-failed",
} as const

export type ImportWalletError = (typeof ImportWalletError)[keyof typeof ImportWalletError]

export type ImportedWallet = {
  readonly accountId: string
  /**
   * Absent when the phrase already belonged to an account on this device: its mode is
   * already stored, and re-entering the phrase is not a new answer about how the account
   * should behave.
   */
  readonly restored?: {
    readonly serverMode: AccountMode | null
    readonly isServerModeKnown: boolean
  }
}

export class SelfCustodialImportError extends Error {
  constructor(public readonly reason: ImportWalletError) {
    super(`Self-custodial import failed: ${reason}`)
    this.name = "SelfCustodialImportError"
  }
}

/**
 * The import counterpart of `useProvisionSelfCustodialAccount`: it derives the wallet
 * from a phrase the user already owns instead of generating a new one.
 *
 * It deliberately does not activate the account or touch the SDK, so a caller mid-flow
 * (the migration) keeps its custodial account active until it commits. That is the one
 * thing this cannot share with the onboarding restore hook, which exists to switch the
 * user over immediately.
 */
export const useImportSelfCustodialAccount = () => {
  const { reloadSelfCustodialAccounts } = useAccountRegistry()
  const network = useSparkNetwork()
  const { selfCustodialDepositClaimLeewayVbyte } = useRemoteConfig()

  /**
   * A phrase already held by an account on this device returns that account instead of
   * deriving a second copy of the same wallet. Re-entering a phrase is not a request for a
   * new account, and two ids over one wallet would make the bookkeeping ambiguous for the
   * rest of the flow.
   *
   * Unlike `provision` there is no beforeCreate hook: the migration records no pending
   * account for an imported wallet, and a wallet derived from a phrase the user holds is
   * recoverable from that phrase, so there is no orphan for one to guard against.
   */
  const importWallet = useCallback(
    async (mnemonic: string): Promise<ImportedWallet> => {
      const normalized = normalizeMnemonic(mnemonic)
      if (!validateMnemonic(normalized)) {
        throw new SelfCustodialImportError(ImportWalletError.InvalidMnemonic)
      }

      const lookup = await findSelfCustodialAccountByMnemonic(normalized)
      // A lookup that cannot read the index must not fall through to creating a wallet:
      // it would derive a duplicate of an account the index simply failed to report.
      if (lookup.status === StorageReadStatus.ReadFailed) {
        throw new SelfCustodialImportError(ImportWalletError.LookupFailed)
      }
      if (lookup.id) return { accountId: lookup.id }

      const accountId = Crypto.randomUUID()
      /** The mode the LNURL server holds travels back with the wallet: it is the one moment
       *  the wallet is connected and able to sign for it, and a caller that discards it
       *  would later push a default Enhanced over a wallet stored as Anon. */
      const { serverMode, isServerModeKnown } = await selfCustodialRestoreWallet({
        accountId,
        mnemonic: normalized,
        network,
        leewaySatPerVbyte: selfCustodialDepositClaimLeewayVbyte,
      })
      await reloadSelfCustodialAccounts()
      return { accountId, restored: { serverMode, isServerModeKnown } }
    },
    [reloadSelfCustodialAccounts, network, selfCustodialDepositClaimLeewayVbyte],
  )

  return { importWallet }
}
