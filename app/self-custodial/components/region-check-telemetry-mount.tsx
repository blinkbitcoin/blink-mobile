/* eslint-disable camelcase */
import React, { useEffect, useSyncExternalStore } from "react"

import { useRestrictedRegion } from "@app/components/restricted-region"
import { useAccountRestrictions } from "@app/hooks/use-account-restrictions"
import { AccountMode } from "@app/types/account"
import {
  getIpCountryLookupGeneration,
  subscribeToIpCountryLookup,
} from "@app/utils/ip-country-lookup"

import { useSelfCustodialAccountMode } from "../hooks/use-self-custodial-account-mode"
import { useSparkNetwork } from "../hooks/use-spark-network"
import { measurementGeneration, measureOnce, ScEvent } from "../measurement"
import { regionCheckOutcome } from "../region-check-outcome"

/**
 * How long a settled verdict must hold before it is reported. A new session bumps the IP
 * lookup generation a commit before the lookup itself goes back to pending, so for one
 * commit the previous session's verdict reads as settled under the new session's key.
 * Waiting for the verdict to hold drops that frame: any change restarts the wait.
 */
export const REGION_CHECK_SETTLE_MS = 1500

/**
 * Reports the region check once per session per account (`sc_region_checked`, KB-27,
 * blink-wip#2147). The key is the measurement generation (account, mode, network) and
 * the IP lookup generation (the session), so a new session or an account switch reports
 * again and a re-render does not. `measureOnce` keeps Incognito, an unset mode and
 * custodial silent, and drops an event whose context ends before it is delivered.
 */
const RegionCheckReporter: React.FC = () => {
  const { isRestrictedRegion, isRestrictedRegionEvaluationPending } =
    useRestrictedRegion()
  const { dollarBalance, transfer, isSettled, isRegionDetermined } =
    useAccountRestrictions()
  const { activeAccountId } = useSelfCustodialAccountMode()
  const network = useSparkNetwork()
  const ipGeneration = useSyncExternalStore(
    subscribeToIpCountryLookup,
    getIpCountryLookupGeneration,
  )

  const outcome = regionCheckOutcome({
    isRestrictedRegion,
    isRestrictedRegionEvaluationPending,
    dollarBalance,
    transfer,
    isSettled,
    isRegionDetermined,
  })
  const regionOutcome = outcome?.region_outcome ?? null

  useEffect(() => {
    if (regionOutcome === null) return undefined
    const params = {
      region_outcome: regionOutcome,
      dollar_balance_restricted: dollarBalance,
      transfer_restricted: transfer,
    }
    const timer = setTimeout(() => {
      measureOnce(
        `region:${measurementGeneration()}:${ipGeneration}`,
        ScEvent.RegionChecked,
        params,
      )
    }, REGION_CHECK_SETTLE_MS)
    return () => clearTimeout(timer)
  }, [regionOutcome, dollarBalance, transfer, ipGeneration, activeAccountId, network])

  return null
}

/** Mounted only for an Enhanced account, so this adds no location lookup to a custodial,
 *  Incognito or unset session: in Incognito no lookup may run at all. */
export const RegionCheckTelemetryMount: React.FC = () => {
  const { accountMode } = useSelfCustodialAccountMode()
  return accountMode === AccountMode.Enhanced ? <RegionCheckReporter /> : null
}
