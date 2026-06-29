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
 */
export const resolveDestination = async (
  params: ParseDestinationParams,
  session: SparkSession,
  lnAddressHostname: string,
): Promise<ParseDestinationResult> => {
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

  const parsed = await parseDestination(params)
  const destination = await resolveUsername(parsed, lnAddressHostname, (rawInput) =>
    parseDestination({ ...params, rawInput }),
  )
  return wrapDestination(destination, sdk)
}
