import { useCallback, useMemo, useRef, useState } from "react"

import { useFocusEffect } from "@react-navigation/native"

import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { useAppConfig } from "@app/hooks/use-app-config"
import { reportError } from "@app/utils/error-logging"

import {
  clearPendingProvisionedAccount,
  getPendingAccountsStorageKey,
  loadPendingProvisionedAccounts,
  savePendingProvisionedAccount,
} from "../utils/migration-checkpoint-storage"

/**
 * Wallets provisioned for a migration but not yet activated, keyed by the custodial
 * account that started the flow. The record never expires: a restarted flow reuses the
 * owner's wallet instead of provisioning a zombie, and the account switcher hides every
 * pending wallet until its migration activates it.
 */
export const usePendingMigrationAccounts = () => {
  const { activeAccount } = useAccountRegistry()
  const [pendingByOwner, setPendingByOwner] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const isMountedRef = useRef(true)

  const activeAccountId = activeAccount?.id ?? null

  const {
    appConfig: {
      galoyInstance: { name: environment },
    },
  } = useAppConfig()

  const storageKey = getPendingAccountsStorageKey(environment)

  const reloadPendingAccounts = useCallback(() => {
    isMountedRef.current = true

    loadPendingProvisionedAccounts(storageKey)
      .then((pending) => {
        if (!isMountedRef.current) return
        setPendingByOwner(pending)
        setLoading(false)
      })
      .catch((err) => {
        reportError("Pending migration accounts load", err)
        if (!isMountedRef.current) return
        setLoading(false)
      })

    return () => {
      isMountedRef.current = false
    }
  }, [storageKey])

  useFocusEffect(reloadPendingAccounts)

  const pendingAccountIds = useMemo(
    () => new Set(Object.values(pendingByOwner)),
    [pendingByOwner],
  )
  const pendingForActiveAccount = activeAccountId
    ? pendingByOwner[activeAccountId] ?? null
    : null

  const savePendingAccount = useCallback(
    async (accountId: string): Promise<void> => {
      if (!activeAccountId) return
      setPendingByOwner((previous) => ({ ...previous, [activeAccountId]: accountId }))
      await savePendingProvisionedAccount(storageKey, {
        custodialAccountId: activeAccountId,
        accountId,
      }).catch((err) => {
        reportError("Pending migration account save", err)
      })
    },
    [storageKey, activeAccountId],
  )

  const clearPendingAccount = useCallback(
    async (custodialAccountId: string): Promise<void> => {
      setPendingByOwner((previous) => {
        const { [custodialAccountId]: cleared, ...rest } = previous
        return rest
      })
      await clearPendingProvisionedAccount(storageKey, custodialAccountId).catch(
        (err) => {
          reportError("Pending migration account clear", err)
        },
      )
    },
    [storageKey],
  )

  return {
    pendingAccountIds,
    pendingForActiveAccount,
    savePendingAccount,
    clearPendingAccount,
    loading,
  }
}
