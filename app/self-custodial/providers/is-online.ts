import { ServiceStatus } from "@breeztech/breez-sdk-spark-react-native"

import { getSparkStatus } from "../bridge"

const ONLINE_STATUSES: readonly ServiceStatus[] = [
  ServiceStatus.Operational,
  ServiceStatus.Degraded,
]

export const getServiceStatus = async (): Promise<ServiceStatus> => {
  try {
    const { status } = await getSparkStatus()
    return status
  } catch {
    return ServiceStatus.Major
  }
}

export const isOnlineStatus = (status: ServiceStatus): boolean =>
  ONLINE_STATUSES.includes(status)

export const isOnline = async (): Promise<boolean> =>
  isOnlineStatus(await getServiceStatus())

export const OnlineState = {
  Online: "online",
  Offline: "offline",
  Unknown: "unknown",
} as const

export type OnlineState = (typeof OnlineState)[keyof typeof OnlineState]

export const getOnlineState = async (): Promise<OnlineState> => {
  try {
    const { status } = await getSparkStatus()
    return isOnlineStatus(status) ? OnlineState.Online : OnlineState.Offline
  } catch {
    return OnlineState.Unknown
  }
}
