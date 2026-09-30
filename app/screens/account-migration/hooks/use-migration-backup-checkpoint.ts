import { useEffect } from "react"

import { useIsFocused } from "@react-navigation/native"

import { useActiveWallet } from "@app/hooks/use-active-wallet"
import { reportError } from "@app/utils/error-logging"

import { MigrationCheckpoint } from "../utils/migration-checkpoint-storage"

import { useMigrationCheckpointState } from "./use-migration-checkpoint-state"

/** Mid-migration the active account is still custodial; onboarding and re-backups run self-custodial. */
export const useMigrationBackupCheckpoint = (step: MigrationCheckpoint) => {
  const { isSelfCustodial } = useActiveWallet()
  const { hasResumableCheckpoint, loading, saveCheckpoint } =
    useMigrationCheckpointState()
  /** The backup screens stay mounted beneath the rest of the flow, the commit screen
   *  included. Saving only while focused keeps one left behind from writing its earlier
   *  step over the commit point, which the record would read as a restart and drop the
   *  expected receive for. The commit screen gates its own save the same way. */
  const isFocused = useIsFocused()

  useEffect(() => {
    const isMigrationBackup = !isSelfCustodial && hasResumableCheckpoint
    const shouldSaveStep = isFocused && !loading && isMigrationBackup
    if (!shouldSaveStep) return
    /** The backup screens have nothing to hold back on a refused write — the phrase is on
     *  screen either way — but a resume that silently loses this step sends the user back
     *  through backup they already did, so the refusal is at least reported. */
    saveCheckpoint(step).then(({ isSaved }) => {
      if (isSaved) return
      reportError(
        "Migration backup checkpoint save",
        new Error(`Backup step ${step} was not persisted`),
      )
    })
  }, [isFocused, loading, isSelfCustodial, hasResumableCheckpoint, saveCheckpoint, step])
}
