import React, { useEffect } from "react"

import { networkLabelFor } from "../config"
import { useAnalyticsCollectionGate } from "../hooks/use-analytics-collection-gate"
import { useSelfCustodialAccountMode } from "../hooks/use-self-custodial-account-mode"
import { useSparkNetwork } from "../hooks/use-spark-network"
import { setMeasurementContext } from "../measurement"

/**
 * Root-level host that keeps the measurement gate's context in step with the active
 * account, so events emitted from non-React code (bridge, adapters, executors) see the
 * mode that is in effect right now — including an account switch, which flips the gate
 * without any screen being involved.
 */
export const TelemetryContextMount: React.FC = () => {
  const { accountMode } = useSelfCustodialAccountMode()
  const network = useSparkNetwork()
  useAnalyticsCollectionGate()

  useEffect(() => {
    setMeasurementContext({ mode: accountMode, network: networkLabelFor(network) })
  }, [accountMode, network])

  return null
}
