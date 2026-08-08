import { useCallback } from "react"

import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { RootStackParamList } from "@app/navigation/stack-param-lists"

import { useHasTransactions } from "./use-has-transactions"
import { useMigrationCheckpoint } from "./use-migration-checkpoint"

/**
 * Routes to the migration flow's next step: a migration resumed at the commit point
 * jumps straight to its checkpoint, while every other run walks the flow and sees the
 * history-download step when there is history to download. replaceToCheckpoint comes
 * from the same checkpoint instance that decides the routing, so a guard that gates on
 * this hook's loading never replaces with a stale destination.
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
   *  only the commit point still skips ahead. */
  const goToNextStep = useCallback(() => {
    const shouldOfferHistoryDownload = hasTransactions && !isAtCommitPoint
    if (shouldOfferHistoryDownload) {
      navigation.navigate("accountMigrationDownloadHistory")
      return
    }
    navigateToCheckpoint()
  }, [navigation, hasTransactions, isAtCommitPoint, navigateToCheckpoint])

  return {
    goToNextStep,
    replaceToCheckpoint,
    loading: transactionsLoading || checkpointLoading,
  }
}
