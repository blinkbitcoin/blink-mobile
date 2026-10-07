import { useCallback, useEffect } from "react"

import { isLocalInstance } from "@app/config/galoy-instances"
import { useAppConfig } from "@app/hooks/use-app-config"
import { useSelfCustodialWallet } from "@app/self-custodial/providers/wallet"
import { ActiveWalletStatus } from "@app/types/wallet"
import { hasFunds } from "@app/utils/has-funds"

import { usePendingProvisionedWallets } from "./use-pending-provisioned-wallets"

type MigrationDeletionGuard = {
  /**
   * Whether this wallet must not be deleted because a migration is still moving funds into
   * it. The answer is the stored mark itself, never a prediction of what the mark is about
   * to become: `deleteWallet` re-reads that same record at the moment of deletion, and a
   * control offered on a more optimistic reading would simply refuse once pressed.
   *
   * Blocks until the record has actually been read. A destructive control offered on the
   * strength of a map that is still empty is a control that may have to take it back, and
   * the Danger Zone's is one the user types a confirmation into first.
   */
  isDeletionBlocked: (accountId: string) => boolean
  /**
   * Whether the record is still being read. A caller whose blocked state carries an
   * explanation needs this: during the read there is nothing to explain yet, so it should
   * offer neither the control nor the reason.
   */
  isLoading: boolean
}

/**
 * The deletion policy for a wallet provisioned by a migration: while the server has moved
 * funds out of the custodial account but nothing proves they landed here, this wallet holds
 * the only key to them, and deleting it destroys that key for good.
 *
 * The block lifts on proof, never on a timer and never merely because the wallet became the
 * active account. Proof is the connected wallet reporting its own settled balance: a funded
 * wallet is one the transfer reached, and deletion from there is already governed by the
 * has-funds warning. So the block only ever bites on an EMPTY wallet that a migration says
 * is still owed funds, which is exactly the loss this guards against.
 *
 * Proof clears the mark rather than merely outvoting it, so the lifted block survives the
 * visit and agrees with what `deleteWallet` reads.
 *
 * KNOWN RESIDUAL, accepted deliberately: a wallet that is EMPTY and whose completion lost
 * its own cleanup write can never produce that proof, so it stays blocked for good and needs
 * support. Reachable through a zero-receive migration, whose wallet is legitimately empty.
 * The alternative is handing out the only key to funds that may still arrive, which is
 * irreversible; the phrase behind this wallet is written down by then. Note that the
 * switcher also hides a marked wallet unless it is active or its migration reports
 * COMPLETED, so such a wallet is hard to reach as well as undeletable.
 *
 * Only the Local instance is exempt, so a migration left half-finished on purpose stays
 * cleanable on the developer's own backend. Staging is NOT exempt: it is where these flows
 * are tested, and a block that switched itself off there could never be verified. The Spark
 * network cannot draw that line, since every instance but Main runs on regtest.
 */
export const useMigrationDeletionGuard = (): MigrationDeletionGuard => {
  const { pendingAccountIds, clearPendingWallet, loading } =
    usePendingProvisionedWallets()
  const { wallets, status, connectedAccountId } = useSelfCustodialWallet()
  const {
    appConfig: {
      galoyInstance: { id: instanceId },
    },
  } = useAppConfig()

  const isDeletionExempt = isLocalInstance(instanceId)

  /**
   * Both halves matter: a balance read before the SDK settled proves nothing, and the
   * provider keeps serving the previous wallet's balances across a switch, so the figures
   * only count for the account they were actually synced for.
   */
  const isConnectedWalletSettled =
    status === ActiveWalletStatus.Ready && connectedAccountId !== null
  const isConnectedWalletFunded = isConnectedWalletSettled && hasFunds(wallets)
  const isConnectedWalletMarkedPending =
    connectedAccountId !== null && pendingAccountIds.has(connectedAccountId)
  const isConnectedWalletMarkStale =
    isConnectedWalletFunded && isConnectedWalletMarkedPending

  /**
   * Drops a mark the funds already outran. Without this, a completion that never got to
   * run its own cleanup would leave a settled wallet permanently undeletable, and the owner
   * id that cleanup keys by is unreachable from a self-custodial session.
   *
   * Runs on every instance, the exempt one included. The deletion block is what Local is
   * exempt from; the record's hygiene is not, and the switcher hides a marked wallet on
   * every instance, so a mark left behind there would stay hidden for good.
   */
  useEffect(() => {
    if (!isConnectedWalletMarkStale) return
    if (connectedAccountId === null) return

    clearPendingWallet(connectedAccountId)
  }, [isConnectedWalletMarkStale, connectedAccountId, clearPendingWallet])

  const isDeletionBlocked = useCallback(
    (accountId: string): boolean => {
      if (isDeletionExempt) return false
      if (loading) return true

      return pendingAccountIds.has(accountId)
    },
    [isDeletionExempt, loading, pendingAccountIds],
  )

  return { isDeletionBlocked, isLoading: loading }
}
