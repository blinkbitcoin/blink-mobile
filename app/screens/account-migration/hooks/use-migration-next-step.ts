import { useCallback } from "react"

import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { RootStackParamList } from "@app/navigation/stack-param-lists"

import { resolveCheckpointRoute } from "../utils/migration-checkpoint-storage"

import { useHasTransactions } from "./use-has-transactions"
import { useMigrationCheckpoint } from "./use-migration-checkpoint"
import { useMigrationLock } from "./use-migration-lock"

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
  const { hasTransactions, loading: transactionsLoading } = useHasTransactions()
  const {
    navigateToCheckpoint,
    replaceToCheckpoint,
    isAtCommitPoint,
    loading: checkpointLoading,
  } = useMigrationCheckpoint()
  const { isLocked, loading: lockLoading, hasError: lockError } = useMigrationLock()

  /** The checkpoint says WHICH screen the device left off on; the server says WHETHER that
   *  migration is still open, and only both together may skip the flow ahead. Without this
   *  the entry screen's own refusal to resume is undone one tap later, landing the user
   *  back on a commit screen for a flow support has already cleared. */
  const isResumable = isAtCommitPoint && isLocked && !lockError

  /** A restarted flow is offered the download again (#4109): it replays every step, and
   *  only the commit point still skips ahead to its checkpoint. */
  const shouldOfferHistoryDownload = hasTransactions && !isResumable

  /** Only a checkpoint that claims the commit point needs redirecting: everything earlier
   *  already resolves to the same place through the route table below, and sending it the
   *  long way round would be a second path to one destination. */
  const isStaleCommitPoint = isAtCommitPoint && !isResumable
  /** Where a flow the server no longer holds open starts again. Resolved through the same
   *  route table the checkpoint uses, so the restart cannot drift from the destination a
   *  checkpoint-less device already gets. */
  const restartDestination = resolveCheckpointRoute(null).name

  const goToNextStep = useCallback(() => {
    if (shouldOfferHistoryDownload) {
      navigation.navigate("accountMigrationDownloadHistory")
      return
    }
    if (isStaleCommitPoint) {
      navigation.navigate(restartDestination)
      return
    }
    navigateToCheckpoint()
  }, [
    navigation,
    shouldOfferHistoryDownload,
    isStaleCommitPoint,
    restartDestination,
    navigateToCheckpoint,
  ])

  /** Same destination as goToNextStep, replacing the current screen: for a guard that
   *  skips its own screen, which must not leave it behind for the back gesture. */
  const replaceToNextStep = useCallback(() => {
    if (shouldOfferHistoryDownload) {
      navigation.replace("accountMigrationDownloadHistory")
      return
    }
    if (isStaleCommitPoint) {
      navigation.replace(restartDestination)
      return
    }
    replaceToCheckpoint()
  }, [
    navigation,
    shouldOfferHistoryDownload,
    isStaleCommitPoint,
    restartDestination,
    replaceToCheckpoint,
  ])

  return {
    goToNextStep,
    replaceToNextStep,
    loading: transactionsLoading || checkpointLoading || lockLoading,
  }
}
