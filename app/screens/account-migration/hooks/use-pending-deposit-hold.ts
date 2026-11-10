import { useCallback, useEffect, useRef, useState } from "react"

import { MigrationSupportReason, PendingDepositCheckStatus } from "@app/types/migration"
import { WindDownStatus } from "@app/types/wind-down"

import { useCustodialPendingDeposits } from "./use-custodial-pending-deposits"
import { useCustodialWindDown } from "./use-custodial-wind-down"
import { useEnsureMigrationStarted } from "./use-ensure-migration-started"
import { useMigrationSupportEmail } from "./use-migration-support-email"

/** Where reading the figures again after a deposit cleared stands. */
const FigureRefresh = {
  Idle: "idle",
  Running: "running",
  Done: "done",
  Failed: "failed",
} as const

type FigureRefresh = (typeof FigureRefresh)[keyof typeof FigureRefresh]

type UsePendingDepositHoldArgs = {
  /** Every other reason the commit screen holds the start back. */
  isStartHeld: boolean
  /** Another modal owns the screen (the dollar balance), and two cannot share it. */
  isModalOutranked: boolean
  /** Reads the figures again, answering true once they have arrived. */
  refreshFigures: () => Promise<boolean>
  /** The server still waits for a destination, so nothing has drained and a figure read
   *  again may replace the one the start bound (mergeCheckpoint). */
  isUndrained: boolean
  /** The transfer screen sent the user back: the server refused the commit for a deposit
   *  still confirming. */
  isCommitRefusedForDeposit: boolean
  /** The server's current answer: this account's migration has not started. */
  isServerFlowNotStarted: boolean
  /** Takes the user out of the migration, for a modal they are free to leave. */
  leaveFlow: () => void
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
 *
 * A deposit that confirms changes the balance the migration sends, and the figures on
 * screen were read before it did. So once one has been pending, the start and Approve also
 * wait until the figures have been read again after it cleared: approving the old ones
 * would bind a receive figure short of what moves, and a zero lets the receive gate open
 * before the deposit's sats arrive.
 */
export const usePendingDepositHold = ({
  isStartHeld,
  isModalOutranked,
  refreshFigures,
  isUndrained,
  isCommitRefusedForDeposit,
  isServerFlowNotStarted,
  leaveFlow,
}: UsePendingDepositHoldArgs) => {
  const {
    hasPendingDeposit,
    isReady: isCheckReady,
    hasError: hasCheckError,
    check: checkAgain,
    recheck,
    isRecheckRunning,
    isStillPending,
  } = useCustodialPendingDeposits()

  const [hasSeenDeposit, setHasSeenDeposit] = useState(false)
  const [figureRefresh, setFigureRefresh] = useState<FigureRefresh>(FigureRefresh.Idle)
  /** How many times the figures have been read again after a deposit cleared, so a caller
   *  can tell a figure it already recorded from one read since. */
  const [figureRefreshes, setFigureRefreshes] = useState(0)
  const isFigureRefreshAwaited = hasSeenDeposit && figureRefresh !== FigureRefresh.Done
  /** The check run after a refused commit: the answer the screen holds may predate the
   *  deposit the server saw, so the figures are not read again before this one answers. */
  const [isRefusalCheckOut, setIsRefusalCheckOut] = useState(false)

  const isBlocking = hasPendingDeposit || !isCheckReady || isFigureRefreshAwaited

  const migrationStart = useEnsureMigrationStarted({ skip: isStartHeld || isBlocking })

  /** After the dollar balance, as in the gate: that one has an action the user can take
   *  right away. A check that is failing yields to the screen's retry, which the modal
   *  would cover and its OK could not resolve. */
  const isDepositPending = hasPendingDeposit || migrationStart.isDepositPending
  const isModalShown = isDepositPending && !isModalOutranked && !hasCheckError

  /** The gate's rule: while the server has not started the run nothing is locked, so a user
   *  held here by a deposit that can take hours to confirm may leave and wait elsewhere.
   *  Only the armed gate, or a run the server has taken, keeps them here, where OK checks
   *  again and support is offered for a deposit that never confirms. */
  const windDown = useCustodialWindDown()
  const isArmedGate = windDown?.status === WindDownStatus.GatedClosed
  const isModalClosable =
    isServerFlowNotStarted && !migrationStart.isStarted && !isArmedGate

  /** Which refresh still speaks for the figures: a deposit seen again retires one that is
   *  still out, since it read a balance that is about to change. */
  const latestRefreshRef = useRef(0)
  useEffect(() => {
    if (!isDepositPending) return
    latestRefreshRef.current += 1
    setHasSeenDeposit(true)
    setFigureRefresh(FigureRefresh.Idle)
  }, [isDepositPending])

  /** A refused commit counts as a deposit seen: the deposits are asked again, and the
   *  figures are read again once it clears, as after any other. */
  useEffect(() => {
    if (!isCommitRefusedForDeposit) return
    latestRefreshRef.current += 1
    setHasSeenDeposit(true)
    setFigureRefresh(FigureRefresh.Idle)
    setIsRefusalCheckOut(true)
    checkAgain().then(() => setIsRefusalCheckOut(false))
  }, [isCommitRefusedForDeposit, checkAgain])

  const isDepositClear = isCheckReady && !isDepositPending && !isRefusalCheckOut
  const shouldRefreshFigures =
    hasSeenDeposit && isDepositClear && figureRefresh === FigureRefresh.Idle
  useEffect(() => {
    if (!shouldRefreshFigures) return
    latestRefreshRef.current += 1
    const refreshId = latestRefreshRef.current
    setFigureRefresh(FigureRefresh.Running)
    refreshFigures().then((isRefreshed) => {
      if (refreshId !== latestRefreshRef.current) return
      setFigureRefresh(isRefreshed ? FigureRefresh.Done : FigureRefresh.Failed)
      if (isRefreshed) setFigureRefreshes((count) => count + 1)
    })
  }, [shouldRefreshFigures, refreshFigures])

  /** For the screen's retry: a refresh that failed is asked again, anything else is left
   *  as it is. */
  const retryFigureRefresh = useCallback(() => {
    setFigureRefresh((current) =>
      current === FigureRefresh.Failed ? FigureRefresh.Idle : current,
    )
  }, [])

  /** Whether the latest reading may replace the bound figure, and whether the save that
   *  carries it is still to land: Approve waits on it, since the receive gate reads the
   *  figure on disk. Counted against the readings, so a later one is waited on again. */
  const isFigureRebindable = figureRefreshes > 0 && isUndrained
  const [recordedFigureRefreshes, setRecordedFigureRefreshes] = useState(0)
  const isRefreshedFigureAwaited =
    isFigureRebindable && recordedFigureRefreshes < figureRefreshes

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
  const acknowledgeModal = isModalClosable ? leaveFlow : acknowledge
  /** The mail carries the reason and the account, as every other migration handover does,
   *  so support can act on the first message. */
  const { sendSupportEmail } = useMigrationSupportEmail(
    MigrationSupportReason.DepositPending,
  )
  const modalSupportAction = isModalClosable ? undefined : sendSupportEmail
  /** Only where OK checks again: where it leaves, there is nothing to try again. */
  const isStillPendingShown = !isModalClosable && isStillPending

  const checkBeforeApprove = useCallback(async (): Promise<boolean> => {
    const depositCheck = await recheck()
    return depositCheck.status === PendingDepositCheckStatus.Clear
  }, [recheck])

  return {
    migrationStart,
    isBlocking,
    isModalShown,
    isModalClosable,
    acknowledgeModal,
    modalSupportAction,
    isStillPendingShown,
    hasCheckError,
    isRecheckRunning,
    acknowledge,
    checkBeforeApprove,
    checkAgain,
    figureRefreshes,
    hasFigureRefreshFailed: figureRefresh === FigureRefresh.Failed,
    retryFigureRefresh,
    /** For the save: marks the figure as read again after a deposit cleared. */
    receiveFigureRefreshed: isFigureRebindable ? (true as const) : undefined,
    isRefreshedFigureAwaited,
    /** Called with the readings a landed save carried. */
    recordRefreshedFigure: setRecordedFigureRefreshes,
  }
}
