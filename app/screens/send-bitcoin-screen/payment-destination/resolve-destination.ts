import { type BreezSdkInterface } from "@breeztech/breez-sdk-spark-react-native"

import { parseSparkAddress } from "@app/self-custodial/bridge"
import { wrapDestination } from "@app/self-custodial/payment-details/wrap-destination"

import { parseDestination } from "./index"
import { type ParseDestinationParams, type ParseDestinationResult } from "./index.types"
import { resolveSparkDestination } from "./spark"

/** parseDestination + self-custodial-aware wrap when an SDK is connected. */
export const resolveDestination = async (
  params: ParseDestinationParams,
  sdk: BreezSdkInterface | null,
  parseSelfCustodialSparkAddress?: (
    sdk: BreezSdkInterface,
    input: string,
  ) => Promise<Awaited<ReturnType<typeof parseSparkAddress>>>,
): Promise<ParseDestinationResult> => {
  if (sdk && parseSelfCustodialSparkAddress) {
    const sparkParsed = await parseSelfCustodialSparkAddress(sdk, params.rawInput)
    if (sparkParsed) {
      return wrapDestination(resolveSparkDestination(sparkParsed), sdk)
    }
  }

  const parsed = await parseDestination(params)
  return sdk ? wrapDestination(parsed, sdk) : parsed
}
