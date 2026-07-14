import { useCallback, useEffect, useRef, useState } from "react"

import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { useAppConfig } from "@app/hooks/use-app-config"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { reportError } from "@app/utils/error-logging"

import {
  MigrationCheckpoint,
  type StoredCheckpoint,
  clearCheckpointFromStorage,
  getStorageKey,
  loadCheckpoint,
  mergeCheckpoint,
  resolveCheckpointRoute,
  saveCheckpointToStorage,
} from "../utils/migration-checkpoint-storage"

export { MigrationCheckpoint }

export const useMigrationCheckpoint = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const { activeAccount } = useAccountRegistry()
  const [stored, setStored] = useState<StoredCheckpoint | null>(null)
  const [loading, setLoading] = useState(true)
  const mountedRef = useRef(true)

  const activeAccountId = activeAccount?.id ?? null

  const {
    appConfig: {
      galoyInstance: { name: environment },
    },
  } = useAppConfig()

  const storageKey = getStorageKey(environment)

  useEffect(() => {
    mountedRef.current = true

    loadCheckpoint(storageKey)
      .then((storedCheckpoint) => {
        if (!mountedRef.current) return
        if (storedCheckpoint) setStored(storedCheckpoint)
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

  /** A checkpoint belongs to the custodial account that saved it; another profile on the
   *  same device starts its own flow instead of resuming, and inheriting, this one. */
  const isOwnedByActiveAccount =
    !stored?.custodialAccountId || stored.custodialAccountId === activeAccountId
  const checkpoint = isOwnedByActiveAccount ? stored?.step ?? null : null
  const accountId = isOwnedByActiveAccount ? stored?.accountId ?? null : null

  /** Resolves false when the write fails, so callers can stop the flow instead of
   *  advancing on a checkpoint that only exists in memory. Re-sending the known
   *  accountId lets a later successful save heal a write that failed. */
  const saveCheckpoint = useCallback(
    async (
      step: MigrationCheckpoint,
      provisionedAccountId?: string,
    ): Promise<boolean> => {
      const update = {
        step,
        accountId: provisionedAccountId ?? accountId ?? undefined,
        custodialAccountId: activeAccountId ?? undefined,
      }
      setStored((existing) => mergeCheckpoint(existing, update))
      try {
        await saveCheckpointToStorage(storageKey, update)
        return true
      } catch (err) {
        reportError("Checkpoint save", err)
        return false
      }
    },
    [storageKey, activeAccountId, accountId],
  )

  const clearCheckpoint = useCallback(() => {
    setStored(null)
    return clearCheckpointFromStorage(storageKey).catch((err) => {
      reportError("Checkpoint clear", err)
    })
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
