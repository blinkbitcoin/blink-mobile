import {
  getSparkStatus as breezGetSparkStatus,
  type SparkStatus,
} from "@breeztech/breez-sdk-spark-react-native"

export const getSparkStatus = (): Promise<SparkStatus> => breezGetSparkStatus()
