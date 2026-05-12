import { type BreezSdkInterface } from "@breeztech/breez-sdk-spark-react-native"

import { parseSparkAddress } from "@app/self-custodial/bridge"
import { wrapDestination } from "@app/self-custodial/payment-details/wrap-destination"

import { parseDestination } from "./index"
import { type ParseDestinationParams, type ParseDestinationResult } from "./index.types"
import { resolveSparkDestination } from "./spark"

/** parseDestination + SC-aware wrap when an SDK is connected. */
export const resolveDestination = async (
  params: ParseDestinationParams,
  sdk: BreezSdkInterface | null,
): Promise<ParseDestinationResult> => {
  if (sdk) {
    const sparkParsed = await parseSparkAddress(sdk, params.rawInput)
    if (sparkParsed) {
      return wrapDestination(resolveSparkDestination(sparkParsed), sdk)
    }
  }

  const parsed = await parseDestination(params)
  return sdk ? wrapDestination(parsed, sdk) : parsed
}
