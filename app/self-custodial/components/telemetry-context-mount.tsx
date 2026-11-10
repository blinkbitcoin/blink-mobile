import React, { useEffect } from "react"

import { usePersistentStateContext } from "@app/store/persistent-state"
import { resolveActiveSelfCustodialId } from "@app/store/persistent-state/active-self-custodial-account"

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
  const { persistentState } = usePersistentStateContext()
  const accountId = persistentState ? resolveActiveSelfCustodialId(persistentState) : null
  const network = useSparkNetwork()
  useAnalyticsCollectionGate()

  useEffect(() => {
    setMeasurementContext({
      accountId,
      mode: accountMode,
      network: networkLabelFor(network),
    })
  }, [accountId, accountMode, network])

  return null
}
