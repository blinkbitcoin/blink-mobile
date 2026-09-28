import { useCallback, useState } from "react"

import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { useInFlightGuard } from "@app/hooks/use-in-flight-guard"
import { useI18nContext } from "@app/i18n/i18n-react"
import { useProvisionSelfCustodialAccount } from "@app/self-custodial/hooks/use-provision-self-custodial-account"
import { reportError } from "@app/utils/error-logging"
import { StorageFailure, StorageWriteError } from "@app/utils/storage/storage-failure"
import { toastShow } from "@app/utils/toast"

import { MigrationCheckpoint } from "../utils/migration-checkpoint-storage"
import { resolveReusablePendingAccount } from "../utils/migration-pending-account"

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
  const reusableAccountId = resolveReusablePendingAccount(
    pendingForActiveAccount,
    accounts,
  )

  const ensureAccount = useCallback(async (): Promise<string | null> => {
    if (accountId) return accountId
    /** A full disk is the one failure the user can clear, so it is named; anything else,
     *  storage or not, keeps the generic copy. */
    const showCreateFailed = (failure: StorageFailure | null): void => {
      const isOutOfSpace = failure === StorageFailure.OutOfSpace
      const message = isOutOfSpace
        ? LL.AccountMigration.storageUnavailable.notSavedOutOfSpaceBody()
        : LL.AccountTypeSelectionScreen.createFailed()
      toastShow({ message, LL })
    }
    setIsProvisioning(true)
    try {
      const provisioned = await guard.run(async () => {
        const newAccountId = reusableAccountId ?? (await provision(savePendingAccount))
        /** The step is the terms screen: resuming may never skip past an unaccepted T&C.
         *  A failed write stops the flow here and leaves no id in the checkpoint, which only
         *  takes what the disk accepted. The pending record written before the wallet is
         *  what a retry resumes from, so it reuses this account instead of provisioning a
         *  second one. */
        const checkpointWrite = await saveCheckpoint(
          MigrationCheckpoint.TermsAndConditions,
          { provisionedAccountId: newAccountId },
        )
        return { newAccountId, checkpointWrite }
      })
      if (!provisioned) return null
      const { newAccountId, checkpointWrite } = provisioned
      if (checkpointWrite.isSaved) return newAccountId

      /** saveCheckpoint already reported a store that refused. A write it turned away for
       *  want of an owner never reached the store and reported nothing, so only that one is
       *  reported here, keeping each failure to a single event. */
      const isRefusedWithoutOwner = checkpointWrite.failure === null
      if (isRefusedWithoutOwner) {
        reportError(
          "Migration account creation",
          new Error("Migration checkpoint save refused without an owner"),
        )
      }
      showCreateFailed(checkpointWrite.failure)
      return null
    } catch (err) {
      reportError("Migration account creation", err)
      /** The pending-record write is the one storage write that throws in here, already
       *  classified by its hook. Provisioning and the SDK throw their own errors, so they
       *  never earn the free-up-space copy. */
      const failure = err instanceof StorageWriteError ? err.failure : null
      showCreateFailed(failure)
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
