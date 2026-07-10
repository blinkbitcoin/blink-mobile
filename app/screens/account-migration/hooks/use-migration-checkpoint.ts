import { useCallback, useEffect, useRef, useState } from "react"

import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { useAppConfig } from "@app/hooks/use-app-config"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { reportError } from "@app/utils/error-logging"

import {
  MigrationCheckpoint,
  clearCheckpointFromStorage,
  getStorageKey,
  loadCheckpoint,
  resolveCheckpointRoute,
  saveCheckpointToStorage,
} from "../utils/migration-checkpoint-storage"

export { MigrationCheckpoint }

export const useMigrationCheckpoint = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const [checkpoint, setCheckpoint] = useState<MigrationCheckpoint | null>(null)
  const [accountId, setAccountId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const mountedRef = useRef(true)

  const {
    appConfig: {
      galoyInstance: { name: environment },
    },
  } = useAppConfig()

  const storageKey = getStorageKey(environment)

  useEffect(() => {
    mountedRef.current = true

    loadCheckpoint(storageKey)
      .then((stored) => {
        if (!mountedRef.current) return
        if (stored) {
          setCheckpoint(stored.step)
          setAccountId(stored.accountId ?? null)
        }
        setLoading(false)
      })
      .catch((err) => {
        reportError("Checkpoint load", err)
        if (!mountedRef.current) return
        setLoading(false)
      })

    return () => {
      mountedRef.current = false
    }
  }, [storageKey])

  const saveCheckpoint = useCallback(
    (step: MigrationCheckpoint, provisionedAccountId?: string) => {
      setCheckpoint(step)
      if (provisionedAccountId) setAccountId(provisionedAccountId)
      return saveCheckpointToStorage(storageKey, step, provisionedAccountId).catch(
        (err) => {
          reportError("Checkpoint save", err)
        },
      )
    },
    [storageKey],
  )

  const clearCheckpoint = useCallback(() => {
    setCheckpoint(null)
    setAccountId(null)
    clearCheckpointFromStorage(storageKey).catch(() => {})
  }, [storageKey])

  // Without a provisioned account, resume from the explainer so it gets provisioned.
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

  // A provisioned account is only stored alongside a checkpoint, so it gates resumability.
  const hasResumableCheckpoint = Boolean(accountId)

  return {
    checkpoint,
    accountId,
    loading,
    saveCheckpoint,
    clearCheckpoint,
    navigateToCheckpoint,
    replaceToCheckpoint,
    hasResumableCheckpoint,
  }
}
