import { useEffect, useState } from "react"

import { useAppConfig } from "@app/hooks"
import {
  listSelfCustodialAccounts,
  StorageReadStatus,
} from "@app/self-custodial/storage/account-index"
import { usePersistentStateContext } from "@app/store/persistent-state"
import { DefaultAccountId } from "@app/types/wallet"

const resolveActiveIsCustodial = (
  activeAccountId: string | undefined,
  knownSelfCustodialIds: ReadonlySet<string> | null,
): boolean => {
  if (!activeAccountId || activeAccountId === DefaultAccountId.Custodial) return true
  if (knownSelfCustodialIds === null) return false
  return !knownSelfCustodialIds.has(activeAccountId)
}

/**
 * Returns the token that should be attached to Apollo requests. Self-custodial
 * mode returns "" to keep custodial data from leaking; a stale `activeAccountId`
 * that no longer matches any self-custodial entry falls back to the custodial
 * token so the user is not silently locked out by an orphaned pointer.
 */
export const useEffectiveAuthToken = (): string => {
  const { appConfig } = useAppConfig()
  const { persistentState } = usePersistentStateContext()
  const { activeAccountId } = persistentState

  const [knownSelfCustodialIds, setKnownSelfCustodialIds] =
    useState<ReadonlySet<string> | null>(null)

  useEffect(() => {
    if (!activeAccountId || activeAccountId === DefaultAccountId.Custodial) {
      setKnownSelfCustodialIds(null)
      return
    }
    let mounted = true
    listSelfCustodialAccounts().then((result) => {
      if (!mounted) return
      if (result.status !== StorageReadStatus.Ok) return
      setKnownSelfCustodialIds(new Set(result.entries.map((e) => e.id)))
    })
    return () => {
      mounted = false
    }
  }, [activeAccountId])

  const activeIsCustodial = resolveActiveIsCustodial(
    activeAccountId,
    knownSelfCustodialIds,
  )

  return activeIsCustodial ? appConfig.token : ""
}
