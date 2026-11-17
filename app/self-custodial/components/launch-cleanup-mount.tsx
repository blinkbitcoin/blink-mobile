import React, { useEffect } from "react"

import { finishPendingSdkLogReset } from "../diagnostics/sdk-log-files"
import { finishPendingStorageRemovals } from "../storage/storage-removal"

/**
 * Root-level host: what a deleted wallet left pending, a log reset and its storage
 * removal, must finish at launch even when no wallet connects again, since the SDK's own
 * start-up is the only other trigger.
 */
export const LaunchCleanupMount: React.FC = () => {
  useEffect(() => {
    finishPendingSdkLogReset()
    finishPendingStorageRemovals()
  }, [])
  return null
}
