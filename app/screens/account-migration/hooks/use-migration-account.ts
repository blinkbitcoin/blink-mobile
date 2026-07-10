import { useCallback } from "react"

import { useInFlightGuard } from "@app/hooks/use-in-flight-guard"
import { useI18nContext } from "@app/i18n/i18n-react"
import { useProvisionSelfCustodialAccount } from "@app/self-custodial/hooks/use-provision-self-custodial-account"
import { reportError } from "@app/utils/error-logging"
import { toastShow } from "@app/utils/toast"

import { MigrationCheckpoint } from "../utils/migration-checkpoint-storage"

import { useMigrationCheckpoint } from "./use-migration-checkpoint"

/** Provisions (without activating) the migration's self-custodial account so the shared
 *  backup screens show its phrase; the id is persisted in the checkpoint for resume. */
export const useMigrationAccount = () => {
  const { accountId, loading, saveCheckpoint } = useMigrationCheckpoint()
  const { provision } = useProvisionSelfCustodialAccount()
  const { LL } = useI18nContext()
  const guard = useInFlightGuard()

  const ensureAccount = useCallback(async (): Promise<string | null> => {
    if (accountId) return accountId
    try {
      const created = await guard.run(async () => {
        const newAccountId = await provision()
        /** Await before navigating so later checkpoint saves preserve the id. The step
         *  is the terms screen: resuming may never skip past an unaccepted T&C. */
        await saveCheckpoint(MigrationCheckpoint.TermsAndConditions, newAccountId)
        return newAccountId
      })
      return created ?? null
    } catch (err) {
      reportError("Migration account creation", err)
      toastShow({ message: LL.AccountTypeSelectionScreen.createFailed(), LL })
      return null
    }
  }, [accountId, guard, provision, saveCheckpoint, LL])

  return { ensureAccount, loading }
}
