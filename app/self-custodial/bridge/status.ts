import {
  getSparkStatus as breezGetSparkStatus,
  type SparkStatus,
} from "@breeztech/breez-sdk-spark-react-native"

export const getSparkStatus = (signal?: AbortSignal): Promise<SparkStatus> =>
  signal ? breezGetSparkStatus({ signal }) : breezGetSparkStatus()
