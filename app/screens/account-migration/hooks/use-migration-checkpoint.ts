import { useCallback } from "react"

import { useNavigation } from "@react-navigation/native"
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
    () => resolveCheckpointRoute(accountId ? checkpoint : null),
    [checkpoint, accountId],
  )

  /** Resumes at the checkpoint's screen, forwarding the terms screen its flow param. */
  const navigateToCheckpoint = useCallback(() => {
    const destination = resolveDestination()
    if (destination.name === "acceptTermsAndConditions") {
      navigation.navigate(destination.name, destination.params)
      return
    }
    navigation.navigate(destination.name)
  }, [resolveDestination, navigation])

  /** Same as navigateToCheckpoint but replacing the current screen (skip guards). */
  const replaceToCheckpoint = useCallback(() => {
    const destination = resolveDestination()
    if (destination.name === "acceptTermsAndConditions") {
      navigation.replace(destination.name, destination.params)
      return
    }
    navigation.replace(destination.name)
  }, [resolveDestination, navigation])

  return {
    ...state,
    navigateToCheckpoint,
    replaceToCheckpoint,
  }
}
