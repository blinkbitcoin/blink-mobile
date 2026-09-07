import { useEffect } from "react"

import { useActiveWallet } from "@app/hooks/use-active-wallet"
import { reportError } from "@app/utils/error-logging"

import { MigrationCheckpoint } from "../utils/migration-checkpoint-storage"

import { useMigrationCheckpointState } from "./use-migration-checkpoint-state"

/** Mid-migration the active account is still custodial; onboarding and re-backups run self-custodial. */
export const useMigrationBackupCheckpoint = (step: MigrationCheckpoint) => {
  const { isSelfCustodial } = useActiveWallet()
  const { hasResumableCheckpoint, loading, saveCheckpoint } =
    useMigrationCheckpointState()

  useEffect(() => {
    const isMigrationBackup = !isSelfCustodial && hasResumableCheckpoint
    if (loading || !isMigrationBackup) return
    /** The backup screens have nothing to hold back on a refused write — the phrase is on
     *  screen either way — but a resume that silently loses this step sends the user back
     *  through backup they already did, so the refusal is at least reported. */
    saveCheckpoint(step).then((isSaved) => {
      if (isSaved) return
      reportError(
        "Migration backup checkpoint save",
        new Error(`Backup step ${step} was not persisted`),
      )
    })
  }, [loading, isSelfCustodial, hasResumableCheckpoint, saveCheckpoint, step])
}
