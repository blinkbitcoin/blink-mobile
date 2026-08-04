import { useCallback } from "react"

import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { RootStackParamList } from "@app/navigation/stack-param-lists"

import { useHasTransactions } from "./use-has-transactions"
import { useMigrationCheckpoint } from "./use-migration-checkpoint"

/**
 * Routes to the migration flow's next step: a resumed migration already passed the
 * download step so it returns to its checkpoint, while a fresh one only sees the
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
    hasResumableCheckpoint,
    loading: checkpointLoading,
  } = useMigrationCheckpoint()

  const goToNextStep = useCallback(() => {
    const shouldOfferHistoryDownload = hasTransactions && !hasResumableCheckpoint
    if (shouldOfferHistoryDownload) {
      navigation.navigate("accountMigrationDownloadHistory")
      return
    }
    navigateToCheckpoint()
  }, [navigation, hasTransactions, hasResumableCheckpoint, navigateToCheckpoint])

  return {
    goToNextStep,
    replaceToCheckpoint,
    loading: transactionsLoading || checkpointLoading,
  }
}
