import React, { useState, createContext, useContext, useEffect } from "react"

import { useLevel } from "@app/graphql/level-context"
import { useAppConfig } from "@app/hooks/use-app-config"
import remoteConfigInstance from "@react-native-firebase/remote-config"

const DeviceAccountEnabledKey = "deviceAccountEnabledRestAuth"
const BalanceLimitToTriggerUpgradeModalKey = "balanceLimitToTriggerUpgradeModal"
const FeedbackEmailKey = "feedbackEmailAddress"
const UpgradeModalCooldownDaysKey = "upgradeModalCooldownDays"
const UpgradeModalShowAtSessionNumberKey = "upgradeModalShowAtSessionNumber"
const SumsubSuccessUrlKey = "sumsubSuccessUrl"
const SumsubRejectUrlKey = "sumsubRejectUrl"

type FeatureFlags = {
  deviceAccountEnabled: boolean
}

type RemoteConfig = {
  [DeviceAccountEnabledKey]: boolean
  [BalanceLimitToTriggerUpgradeModalKey]: number
  [FeedbackEmailKey]: string
  [UpgradeModalCooldownDaysKey]: number
  [UpgradeModalShowAtSessionNumberKey]: number
  [SumsubSuccessUrlKey]: string
  [SumsubRejectUrlKey]: string
}

const defaultRemoteConfig: RemoteConfig = {
  deviceAccountEnabledRestAuth: false,
  balanceLimitToTriggerUpgradeModal: 2100,
  feedbackEmailAddress: "feedback@blink.sv",
  upgradeModalCooldownDays: 7,
  upgradeModalShowAtSessionNumber: 1,
  sumsubSuccessUrl: "https://blink.sv/sumsub/status/success",
  sumsubRejectUrl: "https://blink.sv/sumsub/status/reject",
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
          .getValue(BalanceLimitToTriggerUpgradeModalKey)
          .asNumber()

        const feedbackEmailAddress = remoteConfigInstance()
          .getValue(FeedbackEmailKey)
          .asString()

        const upgradeModalCooldownDays = remoteConfigInstance()
          .getValue(UpgradeModalCooldownDaysKey)
          .asNumber()

        const upgradeModalShowAtSessionNumber = remoteConfigInstance()
          .getValue(UpgradeModalShowAtSessionNumberKey)
          .asNumber()

        const sumsubSuccessUrl = remoteConfigInstance()
          .getValue(SumsubSuccessUrlKey)
          .asString()

        const sumsubRejectUrl = remoteConfigInstance()
          .getValue(SumsubRejectUrlKey)
          .asString()

        setRemoteConfig({
          deviceAccountEnabledRestAuth,
          balanceLimitToTriggerUpgradeModal,
          feedbackEmailAddress,
          upgradeModalCooldownDays,
          upgradeModalShowAtSessionNumber,
          sumsubSuccessUrl,
          sumsubRejectUrl,
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
