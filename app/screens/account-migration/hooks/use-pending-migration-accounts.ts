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

import { useCustodialOwnerId } from "./use-custodial-owner-id"

/**
 * Wallets provisioned for a migration but not yet activated, keyed by the custodial owner
 * (the real Galoy account id, so two profiles on one device stay separate). The record
 * never expires: a restarted flow reuses the owner's wallet instead of provisioning a
 * zombie, and the switcher hides every pending wallet until its migration activates it. A
 * record whose wallet is already the active account is self-healed away on load, so a
 * cleanup write lost to a crash can't hide a funded wallet forever.
 */
export const usePendingMigrationAccounts = () => {
  const { activeAccount } = useAccountRegistry()
  const { ownerId, loading: ownerLoading } = useCustodialOwnerId()
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

        const activatedOwner = Object.keys(pending).find(
          (owner) => pending[owner] === activeAccountId,
        )
        if (activatedOwner) {
          const { [activatedOwner]: activated, ...rest } = pending
          setPendingByOwner(rest)
          setLoading(false)
          clearPendingProvisionedAccount(storageKey, activatedOwner).catch((err) => {
            reportError("Pending migration account self-heal", err)
          })
          return
        }

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
  }, [storageKey, activeAccountId])

  useFocusEffect(reloadPendingAccounts)

  const pendingAccountIds = useMemo(
    () => new Set(Object.values(pendingByOwner)),
    [pendingByOwner],
  )
  const pendingForActiveAccount = ownerId ? pendingByOwner[ownerId] ?? null : null

  /** Run as provision's beforeCreate, so it MUST throw on failure: a swallowed error (or a
   *  missing owner) would let the wallet be created with no record behind it, the orphan
   *  #6 guards against. The write lands before the in-memory update so a failed write
   *  leaves no phantom record either. The caller (ensureAccount) reports and toasts. */
  const savePendingAccount = useCallback(
    async (accountId: string): Promise<void> => {
      if (!ownerId) {
        throw new Error("Cannot record a pending migration account without an owner id")
      }
      await savePendingProvisionedAccount(storageKey, {
        custodialAccountId: ownerId,
        accountId,
      })
      setPendingByOwner((previous) => ({ ...previous, [ownerId]: accountId }))
    },
    [storageKey, ownerId],
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
    ownerId,
    savePendingAccount,
    clearPendingAccount,
    loading: loading || ownerLoading,
  }
}
