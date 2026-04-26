import { ServiceStatus } from "@breeztech/breez-sdk-spark-react-native"

import { getSparkStatus } from "../bridge"

const ONLINE_STATUSES: readonly ServiceStatus[] = [
  ServiceStatus.Operational,
  ServiceStatus.Degraded,
]

const STATUS_TIMEOUT_MS = 5000

export const getServiceStatus = async (): Promise<ServiceStatus> => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), STATUS_TIMEOUT_MS)
  try {
    const { status } = await getSparkStatus(controller.signal)
    return status
  } catch {
    return ServiceStatus.Major
  } finally {
    clearTimeout(timer)
  }
}

export const isOnlineStatus = (status: ServiceStatus): boolean =>
  ONLINE_STATUSES.includes(status)

export const isOnline = async (): Promise<boolean> =>
  isOnlineStatus(await getServiceStatus())
