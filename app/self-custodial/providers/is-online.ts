import { ServiceStatus } from "@breeztech/breez-sdk-spark-react-native"

import { getSparkStatus } from "../bridge"

export const isOnline = async (): Promise<boolean> => {
  try {
    const { status } = await getSparkStatus()
    return status === ServiceStatus.Operational || status === ServiceStatus.Degraded
  } catch {
    return false
  }
}
