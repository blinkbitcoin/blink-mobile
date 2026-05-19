import { useEffect, useState } from "react"

import { useAppConfig } from "@app/hooks"
import {
  listSelfCustodialAccounts,
  StorageReadStatus,
} from "@app/self-custodial/storage/account-index"
import { usePersistentStateContext } from "@app/store/persistent-state"
import { DefaultAccountId } from "@app/types/wallet"
import { reportError } from "@app/utils/error-logging"

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
 * token so the user is not silently locked out by an orphaned pointer. When
 * the self-custodial index read fails outright, fall back to the custodial
 * token too — the alternative is a permanent lockout with no recovery path,
 * which is worse than the brief window where backend-gated screens could see
 * the user's own custodial data.
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
    listSelfCustodialAccounts()
      .then((result) => {
        if (!mounted) return
        if (result.status === StorageReadStatus.Ok) {
          setKnownSelfCustodialIds(new Set(result.entries.map((e) => e.id)))
          return
        }
        reportError("auth-token account-index read", result.error)
        setKnownSelfCustodialIds(new Set())
      })
      .catch((err) => {
        if (!mounted) return
        reportError("auth-token account-index read rejected", err)
        setKnownSelfCustodialIds(new Set())
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
