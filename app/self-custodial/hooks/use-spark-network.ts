import { Network } from "@breeztech/breez-sdk-spark-react-native"

import { useAppConfig } from "@app/hooks/use-app-config"

import { networkForInstance } from "../config"

export const useSparkNetwork = (): Network => {
  const { appConfig } = useAppConfig()
  return networkForInstance(appConfig.galoyInstance.id)
}
