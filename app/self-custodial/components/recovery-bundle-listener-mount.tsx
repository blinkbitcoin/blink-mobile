import React from "react"

import { useRecoveryBundleRefresh } from "../hooks/use-recovery-bundle-refresh"

/**
 * Root-level host for the recovery-bundle refresh listener so the
 * unilateral-exit bundle stays fresh for the whole session, independent of
 * the active screen.
 */
export const RecoveryBundleListenerMount: React.FC = () => {
  useRecoveryBundleRefresh()
  return null
}
