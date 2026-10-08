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
   * Blocks until the record has actually been read, and goes on blocking if it could not
   * be read. A destructive control offered on the strength of a map that is still empty, or
   * one a failed read emptied, is a control that may have to take it back: `deleteWallet`
   * reads the same record strictly and refuses what it cannot clear. The Danger Zone's is
   * one the user types a confirmation into first.
   */
  isDeletionBlocked: (accountId: string) => boolean
  /**
   * Whether the record is still being read. A caller whose blocked state carries an
   * explanation needs this: during the read there is nothing to explain yet, so it should
   * offer neither the control nor the reason.
   */
  isLoading: boolean
  /**
   * Whether the record could not be read at all. Blocked like a marked wallet, but for a
   * reason the blocked copy does not describe, so a caller that explains itself says what
   * actually went wrong instead of leaving the user with nothing.
   */
  hasRecordError: boolean
  /** Reads the record again, for the caller that surfaced a failed read and has to offer a
   *  way out of it: the only other way back is an unprompted blur and refocus. */
  retryRecordRead: () => Promise<void>
}

/**
 * The deletion policy for a wallet provisioned by a migration: while the server has moved
 * funds out of the custodial account but nothing proves they landed here, this wallet holds
 * the only key to them, and deleting it destroys that key for good.
 *
 * The block lifts on proof, never on a timer and never merely because the wallet became the
 * active account. Proof is the connected wallet reporting its own settled balance: a funded
 * wallet is one the transfer reached. So the block only ever bites on an EMPTY wallet that a
 * migration says is still owed funds, which is exactly the loss this guards against.
 *
 * On Main a second line stands behind it, since deleting a funded wallet runs into the
 * has-funds warning. That warning is skipped wherever the Spark network is regtest, which is
 * every instance but Main, so off Main this guard is the only one. The funds there are not
 * real, which is what makes that acceptable rather than a hole.
 *
 * KNOWN RESIDUAL: the wallet is reachable from the moment the server reports COMPLETED,
 * which can precede its receive confirming, so an unrelated payment arriving in that window
 * counts as proof. Closing it needs evidence of the migration's own receipt, which lives
 * behind an SDK connection this screen has no reason to open; every cheaper substitute
 * tried was worse, stranding settled wallets undeletable. On Main, losing funds through it
 * still takes the user emptying the wallet first, past the has-funds warning.
 *
 * Proof clears the mark rather than merely outvoting it, so the lifted block survives the
 * visit and agrees with what `deleteWallet` reads.
 *
 * KNOWN RESIDUAL, accepted deliberately: a wallet that is EMPTY and whose mark outlived the
 * flow can never produce that proof, so it stays blocked for good and needs support. Three
 * ways in: a zero-receive migration, whose wallet is legitimately empty; a completion that
 * lost its own cleanup write; and the handover that releases on the notice window without
 * confirming the receive, which keeps the mark on purpose. The switcher also hides a marked
 * wallet that is neither active nor reported COMPLETED, so such a wallet is hard to reach as
 * well as undeletable, and a user who switches away before the funds land cannot get back to
 * it to let the proof run.
 * The alternative is handing out the only key to funds that may still arrive, which is
 * irreversible; the phrase behind this wallet is written down by then, which is the way
 * back from all three.
 *
 * Only the Local instance is exempt, so a migration left half-finished on purpose stays
 * cleanable on the developer's own backend. Staging is NOT exempt: it is where these flows
 * are tested, and a block that switched itself off there could never be verified. The Spark
 * network cannot draw that line, since every instance but Main runs on regtest.
 */
export const useMigrationDeletionGuard = (): MigrationDeletionGuard => {
  const { pendingAccountIds, clearPendingWallet, loading, hasError, refetch } =
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
   *
   * A settled balance is the proof, deliberately, and not the commit point's promised
   * figure. Measuring against that figure was tried and is worse: the record is shared per
   * environment rather than per migration, and a wallet whose funds landed and were then
   * partly spent, landed a little short of the preview, or were auto-converted to Stable
   * Balance would never match it again and would stay undeletable for good. It is also
   * stricter than the flow's own proof of receive, which asks only that something arrived.
   */
  useEffect(() => {
    if (!isConnectedWalletMarkStale) return
    if (connectedAccountId === null) return

    clearPendingWallet(connectedAccountId)
  }, [isConnectedWalletMarkStale, connectedAccountId, clearPendingWallet])

  const isDeletionBlocked = useCallback(
    (accountId: string): boolean => {
      if (isDeletionExempt) return false
      if (loading || hasError) return true

      return pendingAccountIds.has(accountId)
    },
    [isDeletionExempt, loading, hasError, pendingAccountIds],
  )

  /** Nothing is withheld where nothing is blocked: on the exempt instance the record never
   *  decides anything, so a read of it that is pending or broken must not hide the control
   *  the exemption exists to keep offering. */
  return {
    isDeletionBlocked,
    isLoading: !isDeletionExempt && loading,
    hasRecordError: !isDeletionExempt && hasError,
    retryRecordRead: refetch,
  }
}
