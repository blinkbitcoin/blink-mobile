import React from "react"

import { useTelemetryGate } from "../hooks/use-telemetry-gate"

/**
 * Root-level host: the gate has to track the active account for the whole session, not for
 * as long as some screen happens to be mounted, and it must keep following mode changes
 * after the switch that caused them navigates away.
 */
export const TelemetryGateMount: React.FC = () => {
  useTelemetryGate()
  return null
}
