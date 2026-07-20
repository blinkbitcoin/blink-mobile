import { useCallback, useState } from "react"

import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { useInFlightGuard } from "@app/hooks/use-in-flight-guard"
import { useI18nContext } from "@app/i18n/i18n-react"
import { useProvisionSelfCustodialAccount } from "@app/self-custodial/hooks/use-provision-self-custodial-account"
import { reportError } from "@app/utils/error-logging"
import { toastShow } from "@app/utils/toast"

import { MigrationCheckpoint } from "../utils/migration-checkpoint-storage"

import { useMigrationCheckpointState } from "./use-migration-checkpoint-state"
import { usePendingMigrationAccounts } from "./use-pending-migration-accounts"

/** Provisions (without activating) the migration's self-custodial account so the shared
 *  backup screens show its phrase; the id is persisted in the checkpoint for resume.
 *  isProvisioning drives the caller's in-flight UI, owned here with the operation. */
export const useMigrationAccount = () => {
  const {
    accountId,
    loading: checkpointLoading,
    saveCheckpoint,
  } = useMigrationCheckpointState()
  const {
    pendingForActiveAccount,
    savePendingAccount,
    loading: pendingLoading,
  } = usePendingMigrationAccounts()
  const { accounts, loading: registryLoading } = useAccountRegistry()
  const { provision } = useProvisionSelfCustodialAccount()
  const { LL } = useI18nContext()
  const guard = useInFlightGuard()
  const [isProvisioning, setIsProvisioning] = useState(false)

  /** A wallet provisioned by an earlier abandoned run survives without expiry: reuse it
   *  so a phrase the user may have written down stays valid and no zombies pile up. It
   *  must still exist on the device, otherwise a fresh wallet replaces it. */
  const reusableAccountId =
    pendingForActiveAccount &&
    accounts.some((account) => account.id === pendingForActiveAccount)
      ? pendingForActiveAccount
      : null

  const ensureAccount = useCallback(async (): Promise<string | null> => {
    if (accountId) return accountId
    setIsProvisioning(true)
    try {
      const created = await guard.run(async () => {
        const newAccountId = reusableAccountId ?? (await provision(savePendingAccount))
        /** The step is the terms screen: resuming may never skip past an unaccepted T&C.
         *  A failed write stops the flow here; the provisioned id survives in the hook's
         *  local state, so retrying resumes it instead of provisioning a second account. */
        const isSaved = await saveCheckpoint(
          MigrationCheckpoint.TermsAndConditions,
          newAccountId,
        )
        if (!isSaved) throw new Error("Migration checkpoint save failed")
        return newAccountId
      })
      return created ?? null
    } catch (err) {
      reportError("Migration account creation", err)
      toastShow({ message: LL.AccountTypeSelectionScreen.createFailed(), LL })
      return null
    } finally {
      setIsProvisioning(false)
    }
  }, [
    accountId,
    guard,
    provision,
    reusableAccountId,
    savePendingAccount,
    saveCheckpoint,
    LL,
  ])

  return {
    ensureAccount,
    isProvisioning,
    loading: checkpointLoading || pendingLoading || registryLoading,
  }
}
