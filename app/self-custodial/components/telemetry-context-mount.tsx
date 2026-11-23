import React, { useEffect } from "react"

import { type Network } from "@breeztech/breez-sdk-spark-react-native"

import { usePersistentStateContext } from "@app/store/persistent-state"
import { resolveActiveSelfCustodialId } from "@app/store/persistent-state/active-self-custodial-account"

import { networkLabelFor, sparkTokenIdentifierFor } from "../config"
import { useAnalyticsCollectionGate } from "../hooks/use-analytics-collection-gate"
import { useSelfCustodialAccountMode } from "../hooks/use-self-custodial-account-mode"
import { useSparkNetwork } from "../hooks/use-spark-network"
import { setBandingPrice, setMeasurementContext } from "../measurement"
import { usdPerBtcFrom } from "../price/rate-mapping"
import { useFiatRates } from "../providers/fiat-rates"

/** The dollar token on this network, or null. A mainnet build without its token throws
 *  here, and that is the SDK connect's error to raise, not telemetry's. */
const usdTokenIdentifierFor = (network: Network): string | null => {
  try {
    return sparkTokenIdentifierFor(network)
  } catch {
    return null
  }
}

/**
 * Root-level host that keeps the measurement gate's context in step with the active
 * account, so events emitted from non-React code (bridge, adapters, executors) see the
 * mode that is in effect right now — including an account switch, which flips the gate
 * without any screen being involved.
 *
 * It also hands the gate the price that bands a dollar payment's size, for the same
 * reason: a payment settles in non-React code.
 */
export const TelemetryContextMount: React.FC = () => {
  const { accountMode } = useSelfCustodialAccountMode()
  const { persistentState } = usePersistentStateContext()
  const accountId = persistentState ? resolveActiveSelfCustodialId(persistentState) : null
  const network = useSparkNetwork()
  const { rates } = useFiatRates()
  useAnalyticsCollectionGate()

  useEffect(() => {
    setMeasurementContext({
      accountId,
      mode: accountMode,
      network: networkLabelFor(network),
    })
  }, [accountId, accountMode, network])

  const usdPerBtc = usdPerBtcFrom(rates)
  useEffect(() => {
    setBandingPrice({
      usdPerBtc,
      usdTokenIdentifier: usdTokenIdentifierFor(network),
    })
  }, [usdPerBtc, network])

  return null
}
