import React, { useState, createContext, useContext, useEffect } from "react"

import { useLevel } from "@app/graphql/level-context"
import { useAppConfig } from "@app/hooks"
import remoteConfigInstance from "@react-native-firebase/remote-config"

const DeviceAccountEnabledKey = "deviceAccountEnabledRestAuth"
const balanceLimitToTriggerUpgradeModalKey = "balanceLimitToTriggerUpgradeModal"
const feedbackEmailKey = "feedbackEmailAddress"

type FeatureFlags = {
  deviceAccountEnabled: boolean
}

type RemoteConfig = {
  [DeviceAccountEnabledKey]: boolean
  [balanceLimitToTriggerUpgradeModalKey]: number
  [feedbackEmailKey]: string
}

const defaultRemoteConfig: RemoteConfig = {
  deviceAccountEnabledRestAuth: false,
  balanceLimitToTriggerUpgradeModal: 2100, // SATs
  feedbackEmailAddress: "feedback@blink.sv",
}

const defaultFeatureFlags = {
  deviceAccountEnabled: false,
}

remoteConfigInstance().setDefaults(defaultRemoteConfig)

remoteConfigInstance().setConfigSettings({
  minimumFetchIntervalMillis: 0,
})

export const FeatureFlagContext = createContext<FeatureFlags>(defaultFeatureFlags)
export const RemoteConfigContext = createContext<RemoteConfig>(defaultRemoteConfig)

export const FeatureFlagContextProvider: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  const [remoteConfig, setRemoteConfig] = useState<RemoteConfig>(defaultRemoteConfig)

  const { currentLevel } = useLevel()
  const [remoteConfigReady, setRemoteConfigReady] = useState(false)

  const {
    appConfig: { galoyInstance },
  } = useAppConfig()

  useEffect(() => {
    ;(async () => {
      try {
        await remoteConfigInstance().fetchAndActivate()

        const deviceAccountEnabledRestAuth = remoteConfigInstance()
          .getValue(DeviceAccountEnabledKey)
          .asBoolean()

        const balanceLimitToTriggerUpgradeModal = remoteConfigInstance()
          .getValue(balanceLimitToTriggerUpgradeModalKey)
          .asNumber()

        const feedbackEmailAddress = remoteConfigInstance()
          .getValue(feedbackEmailKey)
          .asString()

        setRemoteConfig({
          deviceAccountEnabledRestAuth,
          balanceLimitToTriggerUpgradeModal,
          feedbackEmailAddress,
        })
      } catch (err) {
        console.error("Error fetching remote config:", err)
      } finally {
        setRemoteConfigReady(true)
      }
    })()
  }, [])

  const featureFlags = {
    deviceAccountEnabled:
      remoteConfig.deviceAccountEnabledRestAuth || galoyInstance.id === "Local",
  }

  if (!remoteConfigReady && currentLevel === "NonAuth") {
    return null
  }

  return (
    <FeatureFlagContext.Provider value={featureFlags}>
      <RemoteConfigContext.Provider value={remoteConfig}>
        {children}
      </RemoteConfigContext.Provider>
    </FeatureFlagContext.Provider>
  )
}

export const useFeatureFlags = () => useContext(FeatureFlagContext)
export const useRemoteConfig = () => useContext(RemoteConfigContext)
