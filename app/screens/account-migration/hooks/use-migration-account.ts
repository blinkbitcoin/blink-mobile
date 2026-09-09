import { useCallback, useState } from "react"

import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { useCustodialOwnerId } from "@app/screens/account-migration/hooks/use-custodial-owner-id"
import { useInFlightGuard } from "@app/hooks/use-in-flight-guard"
import { useI18nContext } from "@app/i18n/i18n-react"
import {
  ImportWalletError,
  SelfCustodialImportError,
  useImportSelfCustodialAccount,
} from "@app/self-custodial/hooks/use-import-self-custodial-account"
import { useProvisionSelfCustodialAccount } from "@app/self-custodial/hooks/use-provision-self-custodial-account"
import { usePersistentStateContext } from "@app/store/persistent-state"
import { withSelfCustodialModeFromServer } from "@app/store/persistent-state/self-custodial-server-account-mode"
import { reportError } from "@app/utils/error-logging"
import { toastShow } from "@app/utils/toast"

import {
  MigrationCheckpoint,
  MigrationTargetOrigin,
} from "../utils/migration-checkpoint-storage"
import { resolveReusablePendingAccount } from "../utils/migration-pending-account"

import { useMigrationCheckpointState } from "./use-migration-checkpoint-state"
import { usePendingMigrationAccounts } from "./use-pending-migration-accounts"

/** Provisions (without activating) the migration's self-custodial account so the shared
 *  backup screens show its phrase; the id is persisted in the checkpoint for resume.
 *  isProvisioning drives the caller's in-flight UI, owned here with the operation. */
export const useMigrationAccount = () => {
  const {
    accountId,
    storedTargetOrigin,
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
  const { importWallet } = useImportSelfCustodialAccount()
  const { updateState } = usePersistentStateContext()
  const { ownerId } = useCustodialOwnerId()
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

  /** An unusable phrase is the user's to correct, so it says so rather than reporting the
   *  generic creation failure that a provisioning fault produces. */
  const messageFor = useCallback(
    (err: unknown): string => {
      const isUnusablePhrase =
        err instanceof SelfCustodialImportError &&
        err.reason === ImportWalletError.InvalidMnemonic
      return isUnusablePhrase
        ? LL.RestoreScreen.invalidMnemonic()
        : LL.AccountTypeSelectionScreen.createFailed()
    },
    [LL],
  )

  /**
   * Both ways of choosing the target wallet end here: whichever account the user ended up
   * with is written to the checkpoint before the flow may move past this screen.
   *
   * `reuseCheckpointed` is what separates them. Provisioning is idempotent, so a run that
   * already has a wallet returns it rather than making a second one. An import is not: the
   * user typed a specific phrase, and answering with the wallet an earlier run provisioned
   * would drain the custodial balance into a wallet they never asked for and hold no
   * phrase for.
   */
  const commitAccount = useCallback(
    async (
      resolveAccountId: () => Promise<{
        accountId: string
        origin: MigrationTargetOrigin
      }>,
      reuseCheckpointed: boolean,
    ): Promise<string | null> => {
      if (accountId && reuseCheckpointed) return accountId
      setIsProvisioning(true)
      try {
        const committed = await guard.run(async () => {
          const { accountId: newAccountId, origin } = await resolveAccountId()
          /** The step is the terms screen: resuming may never skip past an unaccepted T&C.
           *  A failed write stops the flow here; the account id survives in the hook's
           *  local state, so retrying resumes it instead of creating a second account. */
          const isSaved = await saveCheckpoint(MigrationCheckpoint.TermsAndConditions, {
            provisionedAccountId: newAccountId,
            targetOrigin: origin,
          })
          if (!isSaved) throw new Error("Migration checkpoint save failed")
          return newAccountId
        })
        return committed ?? null
      } catch (err) {
        reportError("Migration account creation", err)
        toastShow({ message: messageFor(err), LL })
        return null
      } finally {
        setIsProvisioning(false)
      }
    },
    [accountId, guard, saveCheckpoint, messageFor, LL],
  )

  const ensureAccount = useCallback(
    () =>
      commitAccount(async () => {
        const accountId = reusableAccountId ?? (await provision(savePendingAccount))
        return { accountId, origin: MigrationTargetOrigin.Provisioned }
      }, true),
    [commitAccount, reusableAccountId, provision, savePendingAccount],
  )

  /**
   * The phrase decides the wallet, so a wallet left by an abandoned run is deliberately
   * not reused here: the user asked for this seed, not for that one.
   *
   * No pending account is recorded either way. That record hides a wallet from the account
   * switcher until the migration activates it, which is right for a disposable wallet this
   * flow generated and wrong for one the user holds the phrase to: abandoning the run would
   * hide their own wallet, and nothing clears the record until a migration completes.
   * Resume does not need it — the checkpoint holds the id.
   */
  const importAccount = useCallback(
    (mnemonic: string) =>
      commitAccount(async () => {
        /** The provision path gets this for free: savePendingAccount throws on a missing
         *  owner before the wallet is created. Imports record no pending account, so the
         *  same refusal has to be explicit — otherwise an unresolved owner is only found
         *  by the checkpoint write, with a wallet already derived and registered behind it. */
        if (!ownerId)
          throw new Error("Cannot import a migration wallet without an owner id")

        const { accountId: importedAccountId, restored } = await importWallet(mnemonic)
        /** A restored wallet takes its mode from the server, never from a fresh question:
         *  it was chosen on a device this one may never have been. Skipping this would let
         *  the flow default an Anon wallet to Enhanced and push that back to the server. */
        if (restored?.isServerModeKnown) {
          updateState(
            (prev) =>
              prev &&
              withSelfCustodialModeFromServer(
                prev,
                importedAccountId,
                restored.serverMode,
              ),
          )
        }
        /** Whether the wallet had to be derived only says what happened on THIS pass. A
         *  second pass over the same phrase — a retry after a failed checkpoint write, or
         *  backing out of terms and re-submitting — finds the wallet already here and would
         *  downgrade a restored wallet to adopted, costing it the settings carry-over. The
         *  origin recorded the first time is the one that describes it. */
        const isSameWalletAsCheckpoint = accountId === importedAccountId
        const firstPassOrigin = restored
          ? MigrationTargetOrigin.Restored
          : MigrationTargetOrigin.Adopted
        const origin =
          isSameWalletAsCheckpoint && storedTargetOrigin
            ? storedTargetOrigin
            : firstPassOrigin
        return { accountId: importedAccountId, origin }
      }, false),
    [commitAccount, importWallet, updateState, accountId, storedTargetOrigin, ownerId],
  )

  return {
    ensureAccount,
    importAccount,
    isProvisioning,
    loading: checkpointLoading || pendingLoading || registryLoading,
  }
}
