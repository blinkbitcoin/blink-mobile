import { ServiceStatus } from "@breeztech/breez-sdk-spark-react-native"

import { getSparkStatus } from "../bridge"
import { recordErrorOnce } from "../logging"

const ONLINE_STATUSES: readonly ServiceStatus[] = [
  ServiceStatus.Operational,
  ServiceStatus.Degraded,
]

export const STATUS_TIMEOUT_MS = 5000

const reportSparkStatusFailure = (err: unknown): void => {
  recordErrorOnce(
    "spark-status-fetch-failed",
    err instanceof Error ? err : new Error(`Spark status fetch failed: ${err}`),
  )
}

export const getServiceStatus = async (): Promise<ServiceStatus> => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), STATUS_TIMEOUT_MS)
  try {
    const { status } = await getSparkStatus(controller.signal)
    return status
  } catch (err) {
    reportSparkStatusFailure(err)
    return ServiceStatus.Major
  } finally {
    clearTimeout(timer)
  }
}

export const isOnlineStatus = (status: ServiceStatus): boolean =>
  ONLINE_STATUSES.includes(status)

export const isDegradedStatus = (status: ServiceStatus): boolean =>
  status === ServiceStatus.Degraded

export const isOnline = async (): Promise<boolean> =>
  isOnlineStatus(await getServiceStatus())

export const OnlineState = {
  Online: "online",
  Offline: "offline",
  Unknown: "unknown",
} as const

export type OnlineState = (typeof OnlineState)[keyof typeof OnlineState]

export const getOnlineState = async (): Promise<OnlineState> => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), STATUS_TIMEOUT_MS)
  try {
    const { status } = await getSparkStatus(controller.signal)
    return isOnlineStatus(status) ? OnlineState.Online : OnlineState.Offline
  } catch (err) {
    reportSparkStatusFailure(err)
    return OnlineState.Unknown
  } finally {
    clearTimeout(timer)
  }
}
