import React, { createContext, useContext, useEffect, useState } from "react"
import remoteConfigInstance from "@react-native-firebase/remote-config"

import { useLevel } from "@app/graphql/level-context"
import { useAppConfig } from "@app/hooks/use-app-config"

const DeviceAccountEnabledKey = "deviceAccountEnabledRestAuth"
const BalanceLimitToTriggerUpgradeModalKey = "balanceLimitToTriggerUpgradeModal"
const FeedbackEmailKey = "feedbackEmailAddress"
const UpgradeModalCooldownDaysKey = "upgradeModalCooldownDays"
const UpgradeModalShowAtSessionNumberKey = "upgradeModalShowAtSessionNumber"
const FeeReimbursementMemoKey = "feeReimbursementMemo"
const SuccessIconDurationKey = "successIconDuration"
const CardTermsAndConditionsUrlKey = "cardTermsAndConditionsUrl"
const CardPrivacyPolicyUrlKey = "cardPrivacyPolicyUrl"
const CardCardholderAgreementUrlKey = "cardCardholderAgreementUrl"
const CardSubscriptionPriceUsdKey = "cardSubscriptionPriceUsd"
const CardProcessingWaitTimeHoursKey = "cardProcessingWaitTimeHours"
const ReplaceCardDeliveryConfigKey = "replaceCardDeliveryConfig"
const SparkCompatibleWalletsUrlKey = "sparkCompatibleWalletsUrl"
const NonCustodialEnabledKey = "nonCustodialEnabled"
const StableBalanceEnabledKey = "stableBalanceEnabled"

type DeliveryOptionConfig = {
  minDays: number
  maxDays: number
  priceUsd: number
}

type ReplaceCardDeliveryConfig = Record<string, DeliveryOptionConfig>

type FeatureFlags = {
  deviceAccountEnabled: boolean
  nonCustodialEnabled: boolean
  stableBalanceEnabled: boolean
}

type RemoteConfig = {
  [DeviceAccountEnabledKey]: boolean
  [BalanceLimitToTriggerUpgradeModalKey]: number
  [FeedbackEmailKey]: string
  [UpgradeModalCooldownDaysKey]: number
  [UpgradeModalShowAtSessionNumberKey]: number
  [FeeReimbursementMemoKey]: string
  [SuccessIconDurationKey]: number
  [CardTermsAndConditionsUrlKey]: string
  [CardPrivacyPolicyUrlKey]: string
  [CardCardholderAgreementUrlKey]: string
  [CardSubscriptionPriceUsdKey]: number
  [CardProcessingWaitTimeHoursKey]: number
  [ReplaceCardDeliveryConfigKey]: ReplaceCardDeliveryConfig
  [SparkCompatibleWalletsUrlKey]: string
  [NonCustodialEnabledKey]: boolean
  [StableBalanceEnabledKey]: boolean
}

const defaultReplaceCardDeliveryConfig = {
  standard: { minDays: 7, maxDays: 10, priceUsd: 0 },
  express: { minDays: 1, maxDays: 2, priceUsd: 15 },
}

const defaultRemoteConfig: RemoteConfig = {
  deviceAccountEnabledRestAuth: false,
  balanceLimitToTriggerUpgradeModal: 2100,
  feedbackEmailAddress: "feedback@blink.sv",
  upgradeModalCooldownDays: 7,
  upgradeModalShowAtSessionNumber: 1,
  feeReimbursementMemo: "fee reimbursement",
  successIconDuration: 2300,
  cardTermsAndConditionsUrl: "https://www.blink.sv/en/terms-conditions",
  cardPrivacyPolicyUrl: "https://www.blink.sv/en/privacy-policy",
  cardCardholderAgreementUrl: "https://www.blink.sv",
  cardSubscriptionPriceUsd: 1000,
  cardProcessingWaitTimeHours: 24,
  replaceCardDeliveryConfig: defaultReplaceCardDeliveryConfig,
  sparkCompatibleWalletsUrl: "https://docs.spark.money/wallets/overview",
  nonCustodialEnabled: false,
  stableBalanceEnabled: false,
}

const defaultFeatureFlags: FeatureFlags = {
  deviceAccountEnabled: false,
  nonCustodialEnabled: false,
  stableBalanceEnabled: false,
}

remoteConfigInstance().setDefaults({
  ...defaultRemoteConfig,
  replaceCardDeliveryConfig: JSON.stringify(defaultReplaceCardDeliveryConfig),
})

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

        const feeReimbursementMemo = remoteConfigInstance()
          .getValue(FeeReimbursementMemoKey)
          .asString()
        const successIconDuration = remoteConfigInstance()
          .getValue(SuccessIconDurationKey)
          .asNumber()

        const cardTermsAndConditionsUrl = remoteConfigInstance()
          .getValue(CardTermsAndConditionsUrlKey)
          .asString()

        const cardPrivacyPolicyUrl = remoteConfigInstance()
          .getValue(CardPrivacyPolicyUrlKey)
          .asString()

        const cardCardholderAgreementUrl = remoteConfigInstance()
          .getValue(CardCardholderAgreementUrlKey)
          .asString()

        const cardSubscriptionPriceUsd = remoteConfigInstance()
          .getValue(CardSubscriptionPriceUsdKey)
          .asNumber()

        const cardProcessingWaitTimeHours = remoteConfigInstance()
          .getValue(CardProcessingWaitTimeHoursKey)
          .asNumber()

        const sparkCompatibleWalletsUrl = remoteConfigInstance()
          .getValue(SparkCompatibleWalletsUrlKey)
          .asString()

        const nonCustodialEnabled = remoteConfigInstance()
          .getValue(NonCustodialEnabledKey)
          .asBoolean()

        const stableBalanceEnabled = remoteConfigInstance()
          .getValue(StableBalanceEnabledKey)
          .asBoolean()

        const parsedDeliveryConfig = JSON.parse(
          remoteConfigInstance().getValue(ReplaceCardDeliveryConfigKey).asString(),
        )
        const replaceCardDeliveryConfig: ReplaceCardDeliveryConfig = {
          ...defaultReplaceCardDeliveryConfig,
          ...parsedDeliveryConfig,
        }

        setRemoteConfig({
          deviceAccountEnabledRestAuth,
          balanceLimitToTriggerUpgradeModal,
          feedbackEmailAddress,
          upgradeModalCooldownDays,
          upgradeModalShowAtSessionNumber,
          feeReimbursementMemo,
          successIconDuration,
          cardTermsAndConditionsUrl,
          cardPrivacyPolicyUrl,
          cardCardholderAgreementUrl,
          cardSubscriptionPriceUsd,
          cardProcessingWaitTimeHours,
          replaceCardDeliveryConfig,
          sparkCompatibleWalletsUrl,
          nonCustodialEnabled,
          stableBalanceEnabled,
        })
      } catch (err) {
        console.error("Error fetching remote config:", err)
      } finally {
        setRemoteConfigReady(true)
      }
    })()
  }, [])

  const featureFlags: FeatureFlags = {
    deviceAccountEnabled:
      remoteConfig.deviceAccountEnabledRestAuth || galoyInstance.id === "Local",
    nonCustodialEnabled: remoteConfig.nonCustodialEnabled,
    stableBalanceEnabled:
      remoteConfig.nonCustodialEnabled && remoteConfig.stableBalanceEnabled,
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
