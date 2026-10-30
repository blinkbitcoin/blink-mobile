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
    hasError: hasCheckpointReadError,
    storageFailure: checkpointReadFailure,
    refetch: refetchCheckpoint,
    saveCheckpoint,
  } = useMigrationCheckpointState()
  const {
    pendingForActiveAccount,
    savePendingAccount,
    loading: pendingLoading,
    hasError: hasPendingReadError,
    storageFailure: pendingReadFailure,
    refetch: refetchPending,
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
    /**
     * Both ids below come from the store, and a failed read reports them null exactly as
     * an empty store would. Provisioning against that null would hand a user who already
     * holds a wallet (and may have written its phrase down) a second one, orphaning the
     * first: the zombie the pending record exists to prevent. The reads were already
     * reported, so this only says why the tap did nothing and re-reads, letting the next
     * tap go through once the store answers again.
     */
    const hasResumeReadError = hasCheckpointReadError || hasPendingReadError
    if (hasResumeReadError) {
      const isOutOfSpace =
        checkpointReadFailure === StorageFailure.OutOfSpace ||
        pendingReadFailure === StorageFailure.OutOfSpace
      const { storageUnavailable } = LL.AccountMigration
      const message = isOutOfSpace
        ? storageUnavailable.outOfSpaceBody()
        : storageUnavailable.unreadableBody()
      toastShow({ message, LL })
      refetchCheckpoint()
      refetchPending()
      return null
    }
    /** A store that refused is named as the device's: by then the wallet may well exist,
     *  and telling the user its creation failed would have them retry the wrong thing and
     *  never learn their funds are safe. Only a failure that never reached the store
     *  (provisioning, the SDK, a missing owner) keeps the creation copy. */
    const resolveCreateFailedMessage = (failure: StorageFailure | null): string => {
      const { storageUnavailable } = LL.AccountMigration
      if (failure === StorageFailure.OutOfSpace) {
        return storageUnavailable.notSavedOutOfSpaceBody()
      }
      if (failure !== null) return storageUnavailable.notSavedBody()
      return LL.AccountTypeSelectionScreen.createFailed()
    }
    const showCreateFailed = (failure: StorageFailure | null): void => {
      toastShow({ message: resolveCreateFailedMessage(failure), LL })
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
    hasCheckpointReadError,
    hasPendingReadError,
    checkpointReadFailure,
    pendingReadFailure,
    refetchCheckpoint,
    refetchPending,
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
