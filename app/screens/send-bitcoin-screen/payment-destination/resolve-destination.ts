import {
  type BreezSdkInterface,
  type Network,
} from "@breeztech/breez-sdk-spark-react-native"

import { parseSparkAddress } from "@app/self-custodial/bridge"
import { wrapDestination } from "@app/self-custodial/payment-details/wrap-destination"

import { parseDestination } from "./index"
import {
  isUnresolvedUsername,
  type ParseDestinationParams,
  type ParseDestinationResult,
} from "./index.types"
import { resolveSparkDestination } from "./spark"
import { resolveUsername } from "./resolve-username"

export type SparkSession = {
  sdk: BreezSdkInterface | null
  network: Network
}

/**
 * parseDestination with account-aware resolution: a custodial sender re-tries a Blink
 * username that is not a custodial account as a lightning address over LNURL; a
 * self-custodial sender resolves and wraps through the connected SDK.
 * Surrounding whitespace is trimmed off the raw input before any parsing.
 */
export const resolveDestination = async (
  rawParams: ParseDestinationParams,
  session: SparkSession,
  lnAddressHostname: string,
): Promise<ParseDestinationResult> => {
  const params = { ...rawParams, rawInput: rawParams.rawInput.trim() }
  const { sdk, network } = session
  if (!sdk) {
    const parsed = await parseDestination(params)
    if (isUnresolvedUsername(parsed)) {
      return parseDestination({ ...params, preferLnurlForInternalHandles: true })
    }
    return parsed
  }

  const sparkParsed = await parseSparkAddress(sdk, params.rawInput, network)
  if (sparkParsed) {
    return wrapDestination(resolveSparkDestination(sparkParsed), sdk)
  }

  /**
   * A self-custodial wallet has no token for the intraledger mutation a Blink handle
   * would otherwise resolve to, so its own accounts are paid over lightning like
   * anyone else's. Its domains are declared for the same reason the flag is set: they
   * are what lets a Blink pay code be recognised as naming an account rather than
   * being fetched as an opaque lnurl, which is what showed the pay host on screen.
   */
  const selfCustodialParams = {
    ...params,
    preferLnurlForInternalHandles: true,
    canPayIntraledger: false,
  }
  const parsed = await parseDestination(selfCustodialParams)
  const destination = await resolveUsername(parsed, lnAddressHostname, (rawInput) =>
    parseDestination({ ...selfCustodialParams, rawInput }),
  )
  return wrapDestination(destination, sdk)
}
