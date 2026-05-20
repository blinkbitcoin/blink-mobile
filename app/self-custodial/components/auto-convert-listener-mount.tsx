import React from "react"

import { useAutoConvertListener } from "../hooks/use-auto-convert-listener"

/**
 * Root-level host for the auto-convert listener so it runs for the
 * whole session, independent of the active screen.
 */
export const AutoConvertListenerMount: React.FC = () => {
  useAutoConvertListener()
  return null
}
