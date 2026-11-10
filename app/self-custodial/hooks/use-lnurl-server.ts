import { useMemo } from "react"

import { simulatedOutageHost, useSimulatedOutage } from "@app/config/simulated-outage"

import { resolveLnurlServer, type LnurlServer } from "../config"
import { useSparkNetwork } from "./use-spark-network"

/**
 * The LNURL server this session should talk to, with the developer outage switch already
 * applied.
 *
 * The one place that reads that switch for LNURL. Everything downstream — the mode sync,
 * the SDK config, wallet create and restore — takes the resolved value as an argument, so
 * a reader can see at each call site that the address is something the caller decided
 * rather than something a config function reached out for.
 */
export const useLnurlServer = (): LnurlServer => {
  const network = useSparkNetwork()
  const { lnurlServer } = useSimulatedOutage()
  const outageHost = simulatedOutageHost(lnurlServer)

  return useMemo(() => resolveLnurlServer(network, outageHost), [network, outageHost])
}
