import { getSparkStatus } from "@breeztech/breez-sdk-spark-react-native"

export const getNetworkStatus = async () => {
  const sparkStatus = await getSparkStatus()

  return {
    status: sparkStatus.status,
    lastUpdated: sparkStatus.lastUpdated,
  }
}
