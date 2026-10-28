import React, { useEffect } from "react"

import { finishPendingSdkLogReset } from "../diagnostics/sdk-log-files"

/**
 * Root-level host: a log reset left pending by a deleted wallet must finish at launch even
 * when no wallet connects again, since the SDK's own start-up is the only other trigger.
 */
export const SdkLogResetMount: React.FC = () => {
  useEffect(() => {
    finishPendingSdkLogReset()
  }, [])
  return null
}
