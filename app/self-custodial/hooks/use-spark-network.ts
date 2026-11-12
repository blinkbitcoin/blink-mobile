import { Network } from "@breeztech/breez-sdk-spark-react-native"

import { useAppConfig } from "@app/hooks/use-app-config"

import { hasSparkTokenFor, networkForInstance } from "../config"

export const useSparkNetwork = (): Network => {
  const { appConfig } = useAppConfig()
  return networkForInstance(appConfig.galoyInstance.id)
}

/** False on a network with no dollar token: Staging, unless the build names one. */
export const useHasSparkToken = (): boolean => hasSparkTokenFor(useSparkNetwork())
