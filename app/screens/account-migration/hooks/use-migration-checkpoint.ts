import { useCallback } from "react"

import { CommonActions, StackActions, useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { RootStackParamList } from "@app/navigation/stack-param-lists"

import {
  MigrationCheckpoint,
  resolveCheckpointRoute,
} from "../utils/migration-checkpoint-storage"

import { useMigrationCheckpointState } from "./use-migration-checkpoint-state"

export { MigrationCheckpoint }

/** The checkpoint state plus its navigation: resume screens compose both, while
 *  pure-logic consumers read useMigrationCheckpointState directly. */
export const useMigrationCheckpoint = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const state = useMigrationCheckpointState()
  const { checkpoint, accountId } = state

  /** Without a provisioned account, resume from the explainer so it gets provisioned. */
  const resolveDestination = useCallback(
    () => resolveCheckpointRoute(accountId ? checkpoint : null, accountId),
    [checkpoint, accountId],
  )

  /** Resumes at the checkpoint's screen, forwarding whatever params it resolved with.
   *  Dispatch takes the destination as one typed object; the navigate/replace overloads
   *  cannot, as they need each route name paired with its own params type.
   *  Dollars received after provisioning are caught by the backend, which re-validates an
   *  empty USD wallet on both migrationStart and migrationCommit. The API-key warning has
   *  no such backstop: the backend only refuses callers authenticating WITH an API key,
   *  never accounts that merely hold one, so that precondition stays client-side. */
  const navigateToCheckpoint = useCallback(() => {
    navigation.dispatch(CommonActions.navigate(resolveDestination()))
  }, [resolveDestination, navigation])

  /** Same as navigateToCheckpoint but replacing the current screen (skip guards). */
  const replaceToCheckpoint = useCallback(() => {
    const destination = resolveDestination()
    navigation.dispatch(StackActions.replace(destination.name, destination.params))
  }, [resolveDestination, navigation])

  return {
    ...state,
    navigateToCheckpoint,
    replaceToCheckpoint,
  }
}
