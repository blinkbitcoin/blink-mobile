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

export const OnlineState = {
  Online: "online",
  Offline: "offline",
  Unknown: "unknown",
} as const

export type OnlineState = (typeof OnlineState)[keyof typeof OnlineState]

export const getOnlineState = async (): Promise<OnlineState> => {
  try {
    const { status } = await getSparkStatus()
    if (status === ServiceStatus.Operational || status === ServiceStatus.Degraded) {
      return OnlineState.Online
    }
    return OnlineState.Offline
  } catch {
    return OnlineState.Unknown
  }
}
