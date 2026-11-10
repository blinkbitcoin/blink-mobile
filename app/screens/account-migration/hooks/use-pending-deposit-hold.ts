import { useCallback } from "react"

import { PendingDepositCheckStatus } from "@app/types/migration"

import { useCustodialPendingDeposits } from "./use-custodial-pending-deposits"
import { useEnsureMigrationStarted } from "./use-ensure-migration-started"

type UsePendingDepositHoldArgs = {
  /** Every other reason the commit screen holds the start back. */
  isStartHeld: boolean
  /** Another modal owns the screen (the dollar balance), and two cannot share it. */
  isModalOutranked: boolean
}

/**
 * The commit screen's hold on an on-chain deposit still confirming. The gate checked on the
 * way in, and this catches one that arrived since: it would land after the drain on an
 * account with nothing left to credit it to. A check that has not answered, or failed,
 * holds the start and Approve the same as a deposit does, since neither says there is none.
 *
 * It owns the start because the two hold each other: a deposit holds the start back, and a
 * start the server refuses for a deposit this screen's own check missed (one sent since)
 * brings the modal back.
 */
export const usePendingDepositHold = ({
  isStartHeld,
  isModalOutranked,
}: UsePendingDepositHoldArgs) => {
  const {
    hasPendingDeposit,
    isReady: isCheckReady,
    hasError: hasCheckError,
    check: checkAgain,
    recheck,
    isRecheckRunning,
  } = useCustodialPendingDeposits()
  const isBlocking = hasPendingDeposit || !isCheckReady

  const migrationStart = useEnsureMigrationStarted({ skip: isStartHeld || isBlocking })

  /** After the dollar balance, as in the gate: that one has an action the user can take
   *  right away. A check that is failing yields to the screen's retry, which the modal
   *  would cover and its OK could not resolve. */
  const isDepositPending = hasPendingDeposit || migrationStart.isDepositPending
  const isModalShown = isDepositPending && !isModalOutranked && !hasCheckError

  const { isDepositPending: isStartRefusedForDeposit, retry: retryStart } = migrationStart

  /** OK checks again first, and asks the server to start again only once the deposit has
   *  landed and only when it was the server that refused: asking while it still confirms
   *  is only refused again, and a start this screen's own check held goes out by itself
   *  once that check is clear. */
  const acknowledge = useCallback(async () => {
    const depositCheck = await recheck()
    const isClear = depositCheck.status === PendingDepositCheckStatus.Clear
    const shouldAskServerAgain = isClear && isStartRefusedForDeposit
    if (shouldAskServerAgain) retryStart()
  }, [recheck, isStartRefusedForDeposit, retryStart])

  /** Asked once more right before the drain, so a deposit sent while the user read the
   *  figures is caught here rather than after the balance has moved: a deposit brings the
   *  modal back and a failed check brings the retry, both through the check's own state. */
  const checkBeforeApprove = useCallback(async (): Promise<boolean> => {
    const depositCheck = await recheck()
    return depositCheck.status === PendingDepositCheckStatus.Clear
  }, [recheck])

  return {
    migrationStart,
    isBlocking,
    isModalShown,
    hasCheckError,
    isRecheckRunning,
    acknowledge,
    checkBeforeApprove,
    checkAgain,
  }
}
