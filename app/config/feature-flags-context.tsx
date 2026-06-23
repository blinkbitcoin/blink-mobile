import React, { createContext, useContext, useEffect, useRef, useState } from "react"
import remoteConfigInstance from "@react-native-firebase/remote-config"

import { useLevel } from "@app/graphql/level-context"
import { useAppConfig } from "@app/hooks/use-app-config"
import { useHasCustodialAccount } from "@app/hooks/use-has-custodial-account"
import { logSelfCustodialRolloutExposed } from "@app/self-custodial/analytics"
import { logError } from "@app/utils/log-error"
import {
  getRemoteConfigObject,
  getRemoteConfigStringList,
  serializeRemoteConfigDefault,
} from "@app/utils/remote-config"

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
const BackupNudgeBannerThresholdKey = "backupNudgeBannerThreshold"
const BackupNudgeModalThresholdKey = "backupNudgeModalThreshold"
const NonCustodialEnabledKey = "nonCustodialEnabled"
const StableBalanceEnabledKey = "stableBalanceEnabled"
const AutoConvertMaxAttemptsKey = "autoConvertMaxAttempts"
const AutoConvertPollMaxAttemptsKey = "autoConvertPollMaxAttempts"
const AutoConvertPollIntervalMsKey = "autoConvertPollIntervalMs"
const AutoConvertAmountMatchToleranceBpsKey = "autoConvertAmountMatchToleranceBps"
const CustodialFirstSignupBlockedCountriesKey = "custodialFirstSignupBlockedCountries"
const StablesatsBlockedCountriesKey = "stablesatsBlockedCountries"
const StableTokenBlockedCountriesKey = "stableTokenBlockedCountries"
const StableTokenTransferBlockedCountriesKey = "stableTokenTransferBlockedCountries"
const StablesatsTransferBlockedCountriesKey = "stablesatsTransferBlockedCountries"
const CustodialCreationBlockedCountriesKey = "custodialCreationBlockedCountries"
const SelfCustodialCreationBlockedCountriesKey = "selfCustodialCreationBlockedCountries"

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
  remoteConfigReady: boolean
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
  [BackupNudgeBannerThresholdKey]: number
  [BackupNudgeModalThresholdKey]: number
  [NonCustodialEnabledKey]: boolean
  [StableBalanceEnabledKey]: boolean
  [AutoConvertMaxAttemptsKey]: number
  [AutoConvertPollMaxAttemptsKey]: number
  [AutoConvertPollIntervalMsKey]: number
  [AutoConvertAmountMatchToleranceBpsKey]: number
  [CustodialFirstSignupBlockedCountriesKey]: string[]
  [StablesatsBlockedCountriesKey]: string[]
  [StableTokenBlockedCountriesKey]: string[]
  [StableTokenTransferBlockedCountriesKey]: string[]
  [StablesatsTransferBlockedCountriesKey]: string[]
  [CustodialCreationBlockedCountriesKey]: string[]
  [SelfCustodialCreationBlockedCountriesKey]: string[]
}

const defaultReplaceCardDeliveryConfig = {
  standard: { minDays: 7, maxDays: 10, priceUsd: 0 },
  express: { minDays: 1, maxDays: 2, priceUsd: 15 },
}

/** Default transfer/swap block, read by both account types. */
// prettier-ignore
const transferBlockedDefault = [
  "AT", "BE", "BG", "CY", "CZ", "DE", "DK", "EE", "ES", "FI", "FR", "GR",
  "HR", "HU", "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PL", "PT", "RO",
  "SE", "SI", "SK",
]

/**
 * Default first-custodial-signup block (ISO-3166-1 alpha-2, uppercased). Sources:
 * OFAC sanctions (https://ofac.treasury.gov/sanctions-programs-and-country-information)
 * and Google Play crypto-wallet policy article 16329703
 * (https://support.google.com/googleplay/android-developer/answer/16329703).
 */
// prettier-ignore
const custodialFirstSignupBlockedDefault = [
  // OFAC sanctions
  "CU", "IR", "KP",
  // Google Play 16329703
  "AE", "BH", "CA", "CH", "GB", "ID", "IL", "JP", "KR", "PH", "ZA",
  // Google Play 16329703 (EU-27, MiCA)
  "AT", "BE", "BG", "CY", "CZ", "DE", "DK", "EE", "ES", "FI", "FR", "GR",
  "HR", "HU", "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PL", "PT", "RO",
  "SE", "SI", "SK",
]

/** Default countries where account creation is blocked, redirecting to the Unsupported region screen (both account types). */
// prettier-ignore
const creationBlockedDefault = [
  "CU", "IR", "KP", "SY", "RU", "BY",
]

export const defaultRemoteConfig: RemoteConfig = {
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
  backupNudgeBannerThreshold: 2100,
  backupNudgeModalThreshold: 21000,
  nonCustodialEnabled: false,
  stableBalanceEnabled: false,
  autoConvertMaxAttempts: 3,
  autoConvertPollMaxAttempts: 30,
  autoConvertPollIntervalMs: 500,
  autoConvertAmountMatchToleranceBps: 500,
  custodialFirstSignupBlockedCountries: custodialFirstSignupBlockedDefault,
  stablesatsBlockedCountries: ["HK"],
  stableTokenBlockedCountries: ["HK"],
  stableTokenTransferBlockedCountries: transferBlockedDefault,
  stablesatsTransferBlockedCountries: transferBlockedDefault,
  custodialCreationBlockedCountries: creationBlockedDefault,
  selfCustodialCreationBlockedCountries: creationBlockedDefault,
}

const defaultFeatureFlags: FeatureFlags = {
  deviceAccountEnabled: false,
  nonCustodialEnabled: false,
  stableBalanceEnabled: false,
  remoteConfigReady: false,
}

remoteConfigInstance().setDefaults({
  ...defaultRemoteConfig,
  replaceCardDeliveryConfig: serializeRemoteConfigDefault(
    defaultReplaceCardDeliveryConfig,
  ),
  custodialFirstSignupBlockedCountries: serializeRemoteConfigDefault(
    custodialFirstSignupBlockedDefault,
  ),
  stablesatsBlockedCountries: serializeRemoteConfigDefault(
    defaultRemoteConfig.stablesatsBlockedCountries,
  ),
  stableTokenBlockedCountries: serializeRemoteConfigDefault(
    defaultRemoteConfig.stableTokenBlockedCountries,
  ),
  stableTokenTransferBlockedCountries: serializeRemoteConfigDefault(
    defaultRemoteConfig.stableTokenTransferBlockedCountries,
  ),
  stablesatsTransferBlockedCountries: serializeRemoteConfigDefault(
    defaultRemoteConfig.stablesatsTransferBlockedCountries,
  ),
  custodialCreationBlockedCountries: serializeRemoteConfigDefault(
    defaultRemoteConfig.custodialCreationBlockedCountries,
  ),
  selfCustodialCreationBlockedCountries: serializeRemoteConfigDefault(
    defaultRemoteConfig.selfCustodialCreationBlockedCountries,
  ),
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
  const rolloutLoggedRef = useRef(false)

  const {
    appConfig: { galoyInstance },
  } = useAppConfig()
  const hasCustodialAccount = useHasCustodialAccount()

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

        const backupNudgeBannerThreshold = remoteConfigInstance()
          .getValue(BackupNudgeBannerThresholdKey)
          .asNumber()

        const backupNudgeModalThreshold = remoteConfigInstance()
          .getValue(BackupNudgeModalThresholdKey)
          .asNumber()

        const nonCustodialEnabled = remoteConfigInstance()
          .getValue(NonCustodialEnabledKey)
          .asBoolean()

        const stableBalanceEnabled = remoteConfigInstance()
          .getValue(StableBalanceEnabledKey)
          .asBoolean()

        const autoConvertMaxAttempts = remoteConfigInstance()
          .getValue(AutoConvertMaxAttemptsKey)
          .asNumber()

        const autoConvertPollMaxAttempts = remoteConfigInstance()
          .getValue(AutoConvertPollMaxAttemptsKey)
          .asNumber()

        const autoConvertPollIntervalMs = remoteConfigInstance()
          .getValue(AutoConvertPollIntervalMsKey)
          .asNumber()

        const autoConvertAmountMatchToleranceBps = remoteConfigInstance()
          .getValue(AutoConvertAmountMatchToleranceBpsKey)
          .asNumber()

        const parsedDeliveryConfig = getRemoteConfigObject<ReplaceCardDeliveryConfig>(
          ReplaceCardDeliveryConfigKey,
          {},
        )

        const replaceCardDeliveryConfig: ReplaceCardDeliveryConfig = {
          ...defaultReplaceCardDeliveryConfig,
          ...parsedDeliveryConfig,
        }

        const custodialFirstSignupBlockedCountries = getRemoteConfigStringList(
          CustodialFirstSignupBlockedCountriesKey,
          custodialFirstSignupBlockedDefault,
        )

        const stablesatsBlockedCountries = getRemoteConfigStringList(
          StablesatsBlockedCountriesKey,
          defaultRemoteConfig.stablesatsBlockedCountries,
        )

        const stableTokenBlockedCountries = getRemoteConfigStringList(
          StableTokenBlockedCountriesKey,
          defaultRemoteConfig.stableTokenBlockedCountries,
        )

        const stableTokenTransferBlockedCountries = getRemoteConfigStringList(
          StableTokenTransferBlockedCountriesKey,
          defaultRemoteConfig.stableTokenTransferBlockedCountries,
        )

        const stablesatsTransferBlockedCountries = getRemoteConfigStringList(
          StablesatsTransferBlockedCountriesKey,
          defaultRemoteConfig.stablesatsTransferBlockedCountries,
        )

        const custodialCreationBlockedCountries = getRemoteConfigStringList(
          CustodialCreationBlockedCountriesKey,
          defaultRemoteConfig.custodialCreationBlockedCountries,
        )

        const selfCustodialCreationBlockedCountries = getRemoteConfigStringList(
          SelfCustodialCreationBlockedCountriesKey,
          defaultRemoteConfig.selfCustodialCreationBlockedCountries,
        )

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
          backupNudgeBannerThreshold,
          backupNudgeModalThreshold,
          nonCustodialEnabled,
          stableBalanceEnabled,
          autoConvertMaxAttempts,
          autoConvertPollMaxAttempts,
          autoConvertPollIntervalMs,
          autoConvertAmountMatchToleranceBps,
          custodialFirstSignupBlockedCountries,
          stablesatsBlockedCountries,
          stableTokenBlockedCountries,
          stableTokenTransferBlockedCountries,
          stablesatsTransferBlockedCountries,
          custodialCreationBlockedCountries,
          selfCustodialCreationBlockedCountries,
        })
      } catch (err) {
        logError({
          scope: "remote-config",
          error: err,
          context: { stage: "fetchAndActivate" },
        })
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
    remoteConfigReady,
  }

  useEffect(() => {
    if (!remoteConfigReady) return
    if (rolloutLoggedRef.current) return
    rolloutLoggedRef.current = true
    logSelfCustodialRolloutExposed({
      nonCustodialEnabled: featureFlags.nonCustodialEnabled,
      stableBalanceEnabled: featureFlags.stableBalanceEnabled,
      hasCustodialAccount,
    })
  }, [
    remoteConfigReady,
    featureFlags.nonCustodialEnabled,
    featureFlags.stableBalanceEnabled,
    hasCustodialAccount,
  ])

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
