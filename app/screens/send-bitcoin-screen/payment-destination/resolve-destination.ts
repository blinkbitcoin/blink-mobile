import { type BreezSdkInterface } from "@breeztech/breez-sdk-spark-react-native"

import { parseSparkAddress } from "@app/self-custodial/bridge"
import {
  resolveUsername,
  wrapDestination,
} from "@app/self-custodial/payment-details/wrap-destination"

import { parseDestination } from "./index"
import { type ParseDestinationParams, type ParseDestinationResult } from "./index.types"
import { resolveSparkDestination } from "./spark"

/** parseDestination + self-custodial-aware resolution and wrap when an SDK is connected. */
export const resolveDestination = async (
  params: ParseDestinationParams,
  sdk: BreezSdkInterface | null,
  lnAddressHostname: string,
): Promise<ParseDestinationResult> => {
  if (!sdk) return parseDestination(params)

  const sparkParsed = await parseSparkAddress(sdk, params.rawInput)
  if (sparkParsed) {
    return wrapDestination(resolveSparkDestination(sparkParsed), sdk)
  }

  const parsed = await parseDestination(params)
  const destination = await resolveUsername(parsed, lnAddressHostname, (rawInput) =>
    parseDestination({ ...params, rawInput }),
  )
  return wrapDestination(destination, sdk)
}
