import { useCallback } from "react"

import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { RootStackParamList } from "@app/navigation/stack-param-lists"

import { useHasTransactions } from "./use-has-transactions"
import { useMigrationCheckpoint } from "./use-migration-checkpoint"

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

  /** A restarted flow is offered the download again (#4109): it replays every step, and
   *  only the commit point still skips ahead to its checkpoint. */
  const shouldOfferHistoryDownload = hasTransactions && !isAtCommitPoint

  const goToNextStep = useCallback(() => {
    if (shouldOfferHistoryDownload) {
      navigation.navigate("accountMigrationDownloadHistory")
      return
    }
    navigateToCheckpoint()
  }, [navigation, shouldOfferHistoryDownload, navigateToCheckpoint])

  /** Same destination as goToNextStep, replacing the current screen: for a guard that
   *  skips its own screen, which must not leave it behind for the back gesture. */
  const replaceToNextStep = useCallback(() => {
    if (shouldOfferHistoryDownload) {
      navigation.replace("accountMigrationDownloadHistory")
      return
    }
    replaceToCheckpoint()
  }, [navigation, shouldOfferHistoryDownload, replaceToCheckpoint])

  return {
    goToNextStep,
    replaceToNextStep,
    loading: transactionsLoading || checkpointLoading,
  }
}
