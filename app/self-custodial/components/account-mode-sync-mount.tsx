import React from "react"

import { useAccountModeSync } from "../hooks/use-account-mode-sync"

/**
 * Root-level host: the push often becomes possible long after the mode was chosen, once
 * the SDK connects or the network returns, and no single screen is up for that.
 */
export const AccountModeSyncMount: React.FC = () => {
  useAccountModeSync()
  return null
}
