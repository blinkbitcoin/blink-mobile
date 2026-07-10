import { useEffect } from "react"

import { useActiveWallet } from "@app/hooks/use-active-wallet"

import { MigrationCheckpoint } from "../utils/migration-checkpoint-storage"

import { useMigrationCheckpoint } from "./use-migration-checkpoint"

/** Mid-migration the active account is still custodial; onboarding and re-backups run self-custodial. */
export const useMigrationBackupCheckpoint = (step: MigrationCheckpoint) => {
  const { isSelfCustodial } = useActiveWallet()
  const { hasResumableCheckpoint, loading, saveCheckpoint } = useMigrationCheckpoint()

  useEffect(() => {
    const isMigrationBackup = !isSelfCustodial && hasResumableCheckpoint
    if (loading || !isMigrationBackup) return
    saveCheckpoint(step)
  }, [loading, isSelfCustodial, hasResumableCheckpoint, saveCheckpoint, step])
}
