import { useCallback, useRef } from "react"

import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { CommitPointRoute } from "@app/types/migration"
import { toastShow } from "@app/utils/toast"

import {
  RESTART_ROUTE,
  resolveCommitPointRoute,
} from "../utils/migration-checkpoint-storage"
import {
  isMigrationReceiveSupportDue,
  OVERDUE_RECEIVE_SUPPORT,
} from "../utils/migration-receive-wait"

import { useHasTransactions } from "./use-has-transactions"
import { useMigrationCheckpoint } from "./use-migration-checkpoint"
import { useMigrationLock } from "./use-migration-lock"

/** The two commit-point routes that keep the user where they are. */
type HoldRoute = typeof CommitPointRoute.AwaitSwap | typeof CommitPointRoute.AskAgain

type NextStep =
  | {
      kind: "route"
      name: typeof RESTART_ROUTE | "accountMigrationDownloadHistory"
    }
  | { kind: "checkpoint" }
  | { kind: "hold"; route: HoldRoute }

const HOLD_ROUTES: ReadonlySet<CommitPointRoute> = new Set([
  CommitPointRoute.AwaitSwap,
  CommitPointRoute.AskAgain,
])

const isHoldRoute = (route: CommitPointRoute | null): route is HoldRoute => {
  if (route === null) return false
  return HOLD_ROUTES.has(route)
}

/**
 * Routes to the migration flow's next step: a migration resumed at the commit point
 * jumps straight to its checkpoint, while every other run walks the flow and sees the
 * history-download step when there is history to download. Both entry points share one
 * destination, so a screen that skips itself lands where advancing through it would have.
 * The checkpoint instance deciding the routing is the one this hook reports loading for,
 * so a guard that gates on it never navigates with a stale destination.
 */
export const useMigrationNextStep = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const { LL } = useI18nContext()
  const { hasTransactions, loading: transactionsLoading } = useHasTransactions()
  const {
    navigateToCheckpoint,
    replaceToCheckpoint,
    isAtCommitPoint,
    isStartConfirmed,
    loading: checkpointLoading,
  } = useMigrationCheckpoint()
  const { flow, loading: lockLoading, refetch: refetchLock } = useMigrationLock()

  /**
   * The checkpoint says WHICH screen the device left off on; the server says WHETHER that
   * is still where the user belongs. Only a commit point asks, through the same rule the
   * entry screen follows:
   * - resume: the flow is open, or it never started (the commit screen starts it);
   * - restart: support cleared a flow that had started;
   * - await the swap: the funds moved and this device is finishing on its own. Resuming
   *   would ask the server to start a migration it already finished and hand the user to
   *   support; starting over would drop the expected receive the swap is waiting on;
   * - ask again: no answer. Picking a direction on a guess risks the same drop.
   */
  const commitPointRoute = isAtCommitPoint
    ? resolveCommitPointRoute(flow, isStartConfirmed)
    : null
  const isResumable = commitPointRoute === CommitPointRoute.Resume
  const isClosedCommitPoint = commitPointRoute === CommitPointRoute.Restart
  const commitPointHold = isHoldRoute(commitPointRoute) ? commitPointRoute : null

  /** A restarted flow is offered the download again (#4109): it replays every step, and
   *  only the commit point still skips ahead to its checkpoint. */
  const shouldOfferHistoryDownload = hasTransactions && !isResumable

  /**
   * Where the flow goes once the history step is behind it, whether it was shown or
   * skipped. A restart lands on the explainer, not on the gate the entry screen restarts
   * at: every screen that reaches this hook was reached through the gate, whose
   * preconditions (API keys, a dollar balance, the kill-switch) already ran on the way in.
   */
  const resolvePastHistory = useCallback((): NextStep => {
    if (commitPointHold) return { kind: "hold", route: commitPointHold }
    if (isClosedCommitPoint) return { kind: "route", name: RESTART_ROUTE }
    return { kind: "checkpoint" }
  }, [commitPointHold, isClosedCommitPoint])

  const resolveNextStep = useCallback((): NextStep => {
    if (commitPointHold) return { kind: "hold", route: commitPointHold }
    if (shouldOfferHistoryDownload) {
      return { kind: "route", name: "accountMigrationDownloadHistory" }
    }
    return resolvePastHistory()
  }, [commitPointHold, shouldOfferHistoryDownload, resolvePastHistory])

  /** One re-read at a time: the status query does not report a refetch as loading, so
   *  without this every tap on a held button would stack another request. */
  const isLockRetryInFlightRef = useRef(false)
  const retryLockRead = useCallback(() => {
    if (isLockRetryInFlightRef.current) return
    isLockRetryInFlightRef.current = true
    refetchLock()
      .catch(() => undefined)
      .finally(() => {
        isLockRetryInFlightRef.current = false
      })
  }, [refetchLock])

  /**
   * Keeps the user where they are and says why. The unanswered hold also asks the server
   * again, so the next tap acts on a fresh answer; its wording stays generic, as at the
   * gate, since the read can fail for reasons that are not the user's connection.
   *
   * A skip guard has no screen of its own to hold on (it renders nothing while it waits to
   * skip), so it steps back to the screen that led there rather than leaving a blank one.
   */
  const hold = useCallback(
    (route: HoldRoute, isSkipGuard: boolean) => {
      const isAskingAgain = route === CommitPointRoute.AskAgain
      /** Funds past the notice window, with the app back long enough for a fresh check to
       *  have cleared them, are genuinely late: support takes over instead of another "on
       *  its way". */
      const isReceiveOverdue = !isAskingAgain && isMigrationReceiveSupportDue()
      if (isReceiveOverdue) {
        if (isSkipGuard) {
          navigation.replace("accountMigrationContactSupport", OVERDUE_RECEIVE_SUPPORT)
        } else {
          navigation.navigate("accountMigrationContactSupport", OVERDUE_RECEIVE_SUPPORT)
        }
        return
      }
      if (isAskingAgain) retryLockRead()
      const message = isAskingAgain
        ? LL.errors.generic()
        : LL.AccountMigration.transferDelayed.body()
      toastShow({ message, LL, type: "warning" })
      if (!isSkipGuard) return
      /** Home when there is nothing to step back to, as the entry screen does: a skip guard
       *  left where it is would render nothing with nothing on it to tap. */
      if (navigation.canGoBack()) {
        navigation.goBack()
        return
      }
      navigation.replace("Primary")
    },
    [retryLockRead, LL, navigation],
  )

  const followStep = useCallback(
    (step: NextStep, isSkipGuard: boolean) => {
      if (step.kind === "hold") {
        hold(step.route, isSkipGuard)
        return
      }
      if (step.kind === "route") {
        if (isSkipGuard) navigation.replace(step.name)
        else navigation.navigate(step.name)
        return
      }
      if (isSkipGuard) replaceToCheckpoint()
      else navigateToCheckpoint()
    },
    [hold, navigation, replaceToCheckpoint, navigateToCheckpoint],
  )

  const goToNextStep = useCallback(
    () => followStep(resolveNextStep(), false),
    [followStep, resolveNextStep],
  )

  /** Same destination as goToNextStep, replacing the current screen: for a guard that
   *  skips its own screen, which must not leave it behind for the back gesture. */
  const replaceToNextStep = useCallback(
    () => followStep(resolveNextStep(), true),
    [followStep, resolveNextStep],
  )

  /** For the history step itself: continues through the same routing, so a closed commit
   *  point restarts from there instead of resolving the stored step straight back onto the
   *  commit screen. */
  const continuePastHistory = useCallback(
    () => followStep(resolvePastHistory(), false),
    [followStep, resolvePastHistory],
  )

  return {
    goToNextStep,
    replaceToNextStep,
    continuePastHistory,
    loading: transactionsLoading || checkpointLoading || lockLoading,
  }
}
