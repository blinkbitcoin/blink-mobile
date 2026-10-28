import {
  GetSparkStatusRequest,
  getSparkStatus as breezGetSparkStatus,
  type SparkStatus,
} from "@breeztech/breez-sdk-spark-react-native"

/**
 * The status call runs without an SDK instance, so it cannot pick up `Config.proxy`.
 * If the SDK is ever routed through a proxy, pass the same value here.
 */
export const getSparkStatus = (signal?: AbortSignal): Promise<SparkStatus> => {
  const request = GetSparkStatusRequest.create({ proxy: undefined })
  return signal ? breezGetSparkStatus(request, { signal }) : breezGetSparkStatus(request)
}
