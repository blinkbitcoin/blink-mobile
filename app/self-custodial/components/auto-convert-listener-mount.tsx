import React from "react"

import { useAnonStableBalanceDeactivation } from "../hooks/use-anon-stable-balance-deactivation"
import { useAutoConvertListener } from "../hooks/use-auto-convert-listener"

/**
 * Root-level host for the auto-convert behaviors so they run for the
 * whole session, independent of the active screen.
 */
export const AutoConvertListenerMount: React.FC = () => {
  useAutoConvertListener()
  useAnonStableBalanceDeactivation()
  return null
}
