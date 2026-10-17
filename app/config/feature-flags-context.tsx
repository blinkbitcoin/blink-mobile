import React, { createContext, useContext, useEffect, useRef, useState } from "react"
import remoteConfigInstance from "@react-native-firebase/remote-config"

import { useLevel } from "@app/graphql/level-context"
import { useAppConfig } from "@app/hooks/use-app-config"
import { useHasCustodialAccount } from "@app/hooks/use-has-custodial-account"
import { logSelfCustodialRolloutExposed } from "@app/self-custodial/analytics"
import { logError } from "@app/utils/log-error"
import {
  getRemoteConfigNumericObject,
  getRemoteConfigObject,
  getRemoteConfigPositiveNumber,
  getRemoteConfigStringList,
  serializeRemoteConfigDefault,
} from "@app/utils/remote-config"

const DeviceAccountEnabledKey = "deviceAccountEnabledRestAuth"
const BalanceLimitToTriggerUpgradeModalKey = "balanceLimitToTriggerUpgradeModal"
const FeedbackEmailKey = "feedbackEmailAddress"
const SupportEmailKey = "supportEmailAddress"
const UpgradeModalCooldownDaysKey = "upgradeModalCooldownDays"
const UpgradeModalShowAtSessionNumberKey = "upgradeModalShowAtSessionNumber"
const FeeReimbursementMemoKey = "feeReimbursementMemo"
const SuccessIconDurationKey = "successIconDuration"
const AppLockGracePeriodSecondsKey = "appLockGracePeriodSeconds"
const CardTermsAndConditionsUrlKey = "cardTermsAndConditionsUrl"
const CardPrivacyPolicyUrlKey = "cardPrivacyPolicyUrl"
const CardCardholderAgreementUrlKey = "cardCardholderAgreementUrl"
const CardESignConsentUrlKey = "cardESignConsentUrl"
const CardIssuerPrivacyPolicyUrlKey = "cardIssuerPrivacyPolicyUrl"
const CardSubscriptionPriceUsdKey = "cardSubscriptionPriceUsd"
const CardReplacementFeeUsdKey = "cardReplacementFeeUsd"
const CardUsdTransactionFeePercentKey = "cardUsdTransactionFeePercent"
const CardForeignTransactionFeePercentKey = "cardForeignTransactionFeePercent"
const CardMaxOverdraftUsdKey = "cardMaxOverdraftUsd"
const CardLateRepaymentFeeUsdKey = "cardLateRepaymentFeeUsd"
const ReplaceCardDeliveryConfigKey = "replaceCardDeliveryConfig"
const SparkCompatibleWalletsUrlKey = "sparkCompatibleWalletsUrl"
const CardInvestmentDepositBtcWalletIdKey = "cardInvestmentDepositBtcWalletId"
const BackupNudgeBannerThresholdKey = "backupNudgeBannerThreshold"
const BackupNudgeModalThresholdKey = "backupNudgeModalThreshold"
const BackupNudgeModalCooldownMsKey = "backupNudgeModalCooldownMs"
const NonCustodialEnabledKey = "nonCustodialEnabled"
const StableBalanceEnabledKey = "stableBalanceEnabled"
const BtcMapPlacesEnabledKey = "btcMapPlacesEnabled"
const AutoConvertMaxAttemptsKey = "autoConvertMaxAttempts"
const AutoConvertPollMaxAttemptsKey = "autoConvertPollMaxAttempts"
const AutoConvertPollIntervalMsKey = "autoConvertPollIntervalMs"
const AutoConvertAmountMatchToleranceBpsKey = "autoConvertAmountMatchToleranceBps"
const CustodialFirstSignupBlockedCountriesKey = "custodialFirstSignupBlockedCountries"
const SelfCustodialDollarBalanceBlockedCountriesKey =
  "selfCustodialDollarBalanceBlockedCountries"
const SelfCustodialTransferBlockedCountriesKey = "selfCustodialTransferBlockedCountries"
const SelfCustodialCreationBlockedCountriesKey = "selfCustodialCreationBlockedCountries"
const OffboardOnlyCountriesKey = "offboardOnlyCountries"
const SelfCustodialDepositClaimLeewayVbyteKey = "selfCustodialDepositClaimLeewayVbyte"
const MigrationReceiveDelayedNoticeMsKey = "migrationReceiveDelayedNoticeMs"
const MigrationDelayedRedirectEnabledKey = "migrationDelayedRedirectEnabled"
const PersistentBulletinsEnabledKey = "persistentBulletinsEnabled"
const CustodialTwoFactorEnforcementEnabledKey = "custodialTwoFactorEnforcementEnabled"
const FeeRatesConfigKey = "feeRatesConfig"

type DeliveryOptionConfig = {
  minDays: number
  maxDays: number
  priceUsd: number
}

type ReplaceCardDeliveryConfig = Record<string, DeliveryOptionConfig>

export type FeeRatesConfig = {
  lightningSendBps: number
  onchainPriorityBps: number
  onchainStandardBps: number
  onchainEconomyBps: number
  transferBps: number
}

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
  [SupportEmailKey]: string
  [UpgradeModalCooldownDaysKey]: number
  [UpgradeModalShowAtSessionNumberKey]: number
  [FeeReimbursementMemoKey]: string
  [SuccessIconDurationKey]: number
  [AppLockGracePeriodSecondsKey]: number
  [CardTermsAndConditionsUrlKey]: string
  [CardPrivacyPolicyUrlKey]: string
  [CardCardholderAgreementUrlKey]: string
  [CardESignConsentUrlKey]: string
  [CardIssuerPrivacyPolicyUrlKey]: string
  [CardSubscriptionPriceUsdKey]: number
  [CardReplacementFeeUsdKey]: number
  [CardUsdTransactionFeePercentKey]: number
  [CardForeignTransactionFeePercentKey]: number
  [CardMaxOverdraftUsdKey]: number
  [CardLateRepaymentFeeUsdKey]: number
  [ReplaceCardDeliveryConfigKey]: ReplaceCardDeliveryConfig
  [SparkCompatibleWalletsUrlKey]: string
  [CardInvestmentDepositBtcWalletIdKey]: string
  [BackupNudgeBannerThresholdKey]: number
  [BackupNudgeModalThresholdKey]: number
  [BackupNudgeModalCooldownMsKey]: number
  [NonCustodialEnabledKey]: boolean
  [StableBalanceEnabledKey]: boolean
  [BtcMapPlacesEnabledKey]: boolean
  [AutoConvertMaxAttemptsKey]: number
  [AutoConvertPollMaxAttemptsKey]: number
  [AutoConvertPollIntervalMsKey]: number
  [AutoConvertAmountMatchToleranceBpsKey]: number
  [CustodialFirstSignupBlockedCountriesKey]: string[]
  [SelfCustodialDollarBalanceBlockedCountriesKey]: string[]
  [SelfCustodialTransferBlockedCountriesKey]: string[]
  [SelfCustodialCreationBlockedCountriesKey]: string[]
  [OffboardOnlyCountriesKey]: string[]
  [SelfCustodialDepositClaimLeewayVbyteKey]: number
  [MigrationReceiveDelayedNoticeMsKey]: number
  [MigrationDelayedRedirectEnabledKey]: boolean
  [PersistentBulletinsEnabledKey]: boolean
  [CustodialTwoFactorEnforcementEnabledKey]: boolean
  [FeeRatesConfigKey]: FeeRatesConfig
}

const defaultReplaceCardDeliveryConfig = {
  standard: { minDays: 7, maxDays: 10, priceUsd: 0 },
  express: { minDays: 1, maxDays: 2, priceUsd: 15 },
}

// Fee rates page contract: a negative rate hides its row (and the section when
// no rows remain), 0 renders as "no fee", positive values render the rate — so
// rows can be shown/hidden and repriced remotely without an app release.
//
// The three onchain rates are the payout speeds a custodial send actually
// offers, priced apart because the queue you pick changes what you pay:
// PAYOUT_SPEED_BY_FEE_TIER maps Fast/Medium/Slow onto the ~10m/~4h/~24h queues
// the send screen's tier selector shows. All three ship visible — quoting only
// Priority reads as one flat onchain rate and overstates what a Standard or
// Economy send costs.
export const defaultFeeRatesConfig: FeeRatesConfig = {
  lightningSendBps: 0,
  onchainPriorityBps: 90,
  onchainStandardBps: 60,
  onchainEconomyBps: 40,
  transferBps: 50,
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

/**
 * Offboard-only regions of the custodial sunset: accounts registered there cannot be
 * offered any account, so the home shows the withdraw-your-funds bulletin instead of the
 * migration nudges. Ops empties the remote list after the withdrawal deadline, which is
 * what retires the bulletin — the client never compares dates.
 */
const offboardOnlyDefault = ["AE", "NP", "DZ", "CN", "MM"]

export const defaultRemoteConfig: RemoteConfig = {
  deviceAccountEnabledRestAuth: false,
  balanceLimitToTriggerUpgradeModal: 2100,
  feedbackEmailAddress: "feedback@blink.sv",
  supportEmailAddress: "support@blink.sv",
  upgradeModalCooldownDays: 7,
  upgradeModalShowAtSessionNumber: 1,
  feeReimbursementMemo: "fee reimbursement",
  successIconDuration: 2300,
  appLockGracePeriodSeconds: 60,
  cardTermsAndConditionsUrl: "https://www.blink.sv/en/terms-conditions",
  cardPrivacyPolicyUrl: "https://www.blink.sv/en/privacy-policy",
  cardCardholderAgreementUrl: "https://www.blink.sv/en/blink-card-cardholder-agreement",
  cardESignConsentUrl:
    "https://legal.raincards.xyz/legal/electronic-communications-notice",
  cardIssuerPrivacyPolicyUrl: "https://www.third-national.com/privacypolicy",
  cardSubscriptionPriceUsd: 1000,
  cardReplacementFeeUsd: 10,
  cardUsdTransactionFeePercent: 1.21,
  cardForeignTransactionFeePercent: 2.21,
  cardMaxOverdraftUsd: 200,
  cardLateRepaymentFeeUsd: 25,
  replaceCardDeliveryConfig: defaultReplaceCardDeliveryConfig,
  sparkCompatibleWalletsUrl: "https://docs.spark.money/wallets/overview",
  /** The receiving account's BITCOIN wallet, named by id so a rename cannot redirect the
   *  money. A dollar wallet is refused by the API and reads as a failed invoice. Empty
   *  until that account is decided, and the transfer step cannot pay while it is. */
  cardInvestmentDepositBtcWalletId: "",
  backupNudgeBannerThreshold: 2100,
  backupNudgeModalThreshold: 21000,
  /** How long the self-custodial backup modal stays dismissed after the user closes it.
   *  The less intrusive home-screen nudge banner takes over in the meantime, so the
   *  warning never disappears entirely (#4156). */
  backupNudgeModalCooldownMs: 24 * 60 * 60 * 1000,
  nonCustodialEnabled: false,
  stableBalanceEnabled: false,
  /** Kill switch for the map's merchant data, which comes from BTC Map — a third
   *  party we do not control. If the feed starts serving something harmful or
   *  simply wrong, turning this off empties the map without an app release. */
  btcMapPlacesEnabled: true,
  autoConvertMaxAttempts: 3,
  autoConvertPollMaxAttempts: 30,
  autoConvertPollIntervalMs: 500,
  autoConvertAmountMatchToleranceBps: 500,
  custodialFirstSignupBlockedCountries: custodialFirstSignupBlockedDefault,
  selfCustodialDollarBalanceBlockedCountries: ["HK"],
  selfCustodialTransferBlockedCountries: transferBlockedDefault,
  selfCustodialCreationBlockedCountries: creationBlockedDefault,
  offboardOnlyCountries: offboardOnlyDefault,
  selfCustodialDepositClaimLeewayVbyte: 1,
  /** How long the migration's receive gate waits before telling the user the incoming
   *  payment is taking longer than usual and offering support. Product call on #4102:
   *  a minute after the confirmed send is more than enough for a healthy receive. */
  migrationReceiveDelayedNoticeMs: 60 * 1000,
  /** Escape hatch should requirements change: when on, the migration's receive gate
   *  releases the redirect once the notice window elapses instead of holding the swap
   *  until the receive confirms. Off by default — waiting is the product decision. */
  migrationDelayedRedirectEnabled: false,
  /** Whether the home honours a bulletin the server marks as not dismissible. Off by
   *  default, so every bulletin keeps its close control, as before the flag existed; on,
   *  such a bulletin stays until the server retires it. A console toggle, so a bulletin
   *  stuck on every home by mistake can be made closable again without a release. */
  persistentBulletinsEnabled: false,
  /** Whether a custodial account's balance earns it two-factor prompts. Off by default
   *  so the prompts reach users only once the console turns them on, and can be pulled
   *  back the same way without a release. */
  custodialTwoFactorEnforcementEnabled: false,
  feeRatesConfig: defaultFeeRatesConfig,
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
  selfCustodialDollarBalanceBlockedCountries: serializeRemoteConfigDefault(
    defaultRemoteConfig.selfCustodialDollarBalanceBlockedCountries,
  ),
  selfCustodialTransferBlockedCountries: serializeRemoteConfigDefault(
    defaultRemoteConfig.selfCustodialTransferBlockedCountries,
  ),
  selfCustodialCreationBlockedCountries: serializeRemoteConfigDefault(
    defaultRemoteConfig.selfCustodialCreationBlockedCountries,
  ),
  offboardOnlyCountries: serializeRemoteConfigDefault(
    defaultRemoteConfig.offboardOnlyCountries,
  ),
  feeRatesConfig: serializeRemoteConfigDefault(defaultFeeRatesConfig),
})

remoteConfigInstance().setConfigSettings({
  minimumFetchIntervalMillis: 0,
})

/** A value Firebase holds for the key, or none while it holds only the static empty
 *  one: the shipped defaults above are applied asynchronously, and a read before that
 *  lands sees every key as an empty static value, which is no value at all. */
const activatedValue = (key: string) => {
  const value = remoteConfigInstance().getValue(key)
  return value.getSource() === "static" ? null : value
}

const readBoolean = (key: string, fallback: boolean): boolean =>
  activatedValue(key)?.asBoolean() ?? fallback

const readNumber = (key: string, fallback: number): number =>
  activatedValue(key)?.asNumber() ?? fallback

const readString = (key: string, fallback: string): string =>
  activatedValue(key)?.asString() ?? fallback

/**
 * Reads the config Firebase has activated: the values of the last fetch, persisted
 * on the device, or the shipped defaults before any fetch. Read at the first render
 * as well as after each fetch, so no flag is defaulted for the seconds a fetch takes.
 * A key Firebase holds nothing for yet reads as its shipped default.
 */
const readRemoteConfig = (): RemoteConfig => {
  const deviceAccountEnabledRestAuth = readBoolean(
    DeviceAccountEnabledKey,
    defaultRemoteConfig.deviceAccountEnabledRestAuth,
  )

  const balanceLimitToTriggerUpgradeModal = readNumber(
    BalanceLimitToTriggerUpgradeModalKey,
    defaultRemoteConfig.balanceLimitToTriggerUpgradeModal,
  )

  const feedbackEmailAddress = readString(
    FeedbackEmailKey,
    defaultRemoteConfig.feedbackEmailAddress,
  )

  const supportEmailAddress = readString(
    SupportEmailKey,
    defaultRemoteConfig.supportEmailAddress,
  )

  const upgradeModalCooldownDays = readNumber(
    UpgradeModalCooldownDaysKey,
    defaultRemoteConfig.upgradeModalCooldownDays,
  )

  const upgradeModalShowAtSessionNumber = readNumber(
    UpgradeModalShowAtSessionNumberKey,
    defaultRemoteConfig.upgradeModalShowAtSessionNumber,
  )

  const feeReimbursementMemo = readString(
    FeeReimbursementMemoKey,
    defaultRemoteConfig.feeReimbursementMemo,
  )
  const successIconDuration = readNumber(
    SuccessIconDurationKey,
    defaultRemoteConfig.successIconDuration,
  )

  const appLockGracePeriodSeconds = readNumber(
    AppLockGracePeriodSecondsKey,
    defaultRemoteConfig.appLockGracePeriodSeconds,
  )

  const cardTermsAndConditionsUrl = readString(
    CardTermsAndConditionsUrlKey,
    defaultRemoteConfig.cardTermsAndConditionsUrl,
  )

  const cardPrivacyPolicyUrl = readString(
    CardPrivacyPolicyUrlKey,
    defaultRemoteConfig.cardPrivacyPolicyUrl,
  )

  const cardCardholderAgreementUrl = readString(
    CardCardholderAgreementUrlKey,
    defaultRemoteConfig.cardCardholderAgreementUrl,
  )

  const cardESignConsentUrl = readString(
    CardESignConsentUrlKey,
    defaultRemoteConfig.cardESignConsentUrl,
  )

  const cardIssuerPrivacyPolicyUrl = readString(
    CardIssuerPrivacyPolicyUrlKey,
    defaultRemoteConfig.cardIssuerPrivacyPolicyUrl,
  )

  const cardSubscriptionPriceUsd = readNumber(
    CardSubscriptionPriceUsdKey,
    defaultRemoteConfig.cardSubscriptionPriceUsd,
  )

  const cardReplacementFeeUsd = readNumber(
    CardReplacementFeeUsdKey,
    defaultRemoteConfig.cardReplacementFeeUsd,
  )

  const cardUsdTransactionFeePercent = readNumber(
    CardUsdTransactionFeePercentKey,
    defaultRemoteConfig.cardUsdTransactionFeePercent,
  )

  const cardForeignTransactionFeePercent = readNumber(
    CardForeignTransactionFeePercentKey,
    defaultRemoteConfig.cardForeignTransactionFeePercent,
  )

  const cardMaxOverdraftUsd = readNumber(
    CardMaxOverdraftUsdKey,
    defaultRemoteConfig.cardMaxOverdraftUsd,
  )

  const cardLateRepaymentFeeUsd = readNumber(
    CardLateRepaymentFeeUsdKey,
    defaultRemoteConfig.cardLateRepaymentFeeUsd,
  )

  const sparkCompatibleWalletsUrl = readString(
    SparkCompatibleWalletsUrlKey,
    defaultRemoteConfig.sparkCompatibleWalletsUrl,
  )

  const cardInvestmentDepositBtcWalletId = readString(
    CardInvestmentDepositBtcWalletIdKey,
    defaultRemoteConfig.cardInvestmentDepositBtcWalletId,
  )

  const backupNudgeBannerThreshold = readNumber(
    BackupNudgeBannerThresholdKey,
    defaultRemoteConfig.backupNudgeBannerThreshold,
  )

  const backupNudgeModalThreshold = readNumber(
    BackupNudgeModalThresholdKey,
    defaultRemoteConfig.backupNudgeModalThreshold,
  )

  // asNumber() yields 0 for a malformed remote value, and a zero cooldown would
  // make the modal undismissable again — fall back to the shipped default.
  const remoteBackupNudgeModalCooldownMs = readNumber(
    BackupNudgeModalCooldownMsKey,
    defaultRemoteConfig.backupNudgeModalCooldownMs,
  )
  const backupNudgeModalCooldownMs =
    remoteBackupNudgeModalCooldownMs > 0
      ? remoteBackupNudgeModalCooldownMs
      : defaultRemoteConfig.backupNudgeModalCooldownMs

  const nonCustodialEnabled = readBoolean(
    NonCustodialEnabledKey,
    defaultRemoteConfig.nonCustodialEnabled,
  )

  const stableBalanceEnabled = readBoolean(
    StableBalanceEnabledKey,
    defaultRemoteConfig.stableBalanceEnabled,
  )

  const btcMapPlacesEnabled = readBoolean(
    BtcMapPlacesEnabledKey,
    defaultRemoteConfig.btcMapPlacesEnabled,
  )

  const autoConvertMaxAttempts = readNumber(
    AutoConvertMaxAttemptsKey,
    defaultRemoteConfig.autoConvertMaxAttempts,
  )

  const autoConvertPollMaxAttempts = readNumber(
    AutoConvertPollMaxAttemptsKey,
    defaultRemoteConfig.autoConvertPollMaxAttempts,
  )

  const autoConvertPollIntervalMs = readNumber(
    AutoConvertPollIntervalMsKey,
    defaultRemoteConfig.autoConvertPollIntervalMs,
  )

  const autoConvertAmountMatchToleranceBps = readNumber(
    AutoConvertAmountMatchToleranceBpsKey,
    defaultRemoteConfig.autoConvertAmountMatchToleranceBps,
  )

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

  const selfCustodialDollarBalanceBlockedCountries = getRemoteConfigStringList(
    SelfCustodialDollarBalanceBlockedCountriesKey,
    defaultRemoteConfig.selfCustodialDollarBalanceBlockedCountries,
  )

  const selfCustodialTransferBlockedCountries = getRemoteConfigStringList(
    SelfCustodialTransferBlockedCountriesKey,
    defaultRemoteConfig.selfCustodialTransferBlockedCountries,
  )

  const selfCustodialCreationBlockedCountries = getRemoteConfigStringList(
    SelfCustodialCreationBlockedCountriesKey,
    defaultRemoteConfig.selfCustodialCreationBlockedCountries,
  )

  const offboardOnlyCountries = getRemoteConfigStringList(
    OffboardOnlyCountriesKey,
    defaultRemoteConfig.offboardOnlyCountries,
  )

  const selfCustodialDepositClaimLeewayVbyte = readNumber(
    SelfCustodialDepositClaimLeewayVbyteKey,
    defaultRemoteConfig.selfCustodialDepositClaimLeewayVbyte,
  )

  const migrationReceiveDelayedNoticeMs = getRemoteConfigPositiveNumber(
    MigrationReceiveDelayedNoticeMsKey,
    defaultRemoteConfig.migrationReceiveDelayedNoticeMs,
  )

  const migrationDelayedRedirectEnabled = readBoolean(
    MigrationDelayedRedirectEnabledKey,
    defaultRemoteConfig.migrationDelayedRedirectEnabled,
  )

  const persistentBulletinsEnabled = readBoolean(
    PersistentBulletinsEnabledKey,
    defaultRemoteConfig.persistentBulletinsEnabled,
  )

  const custodialTwoFactorEnforcementEnabled = readBoolean(
    CustodialTwoFactorEnforcementEnabledKey,
    defaultRemoteConfig.custodialTwoFactorEnforcementEnabled,
  )

  const feeRatesConfig = getRemoteConfigNumericObject(
    FeeRatesConfigKey,
    defaultFeeRatesConfig,
  )

  return {
    deviceAccountEnabledRestAuth,
    balanceLimitToTriggerUpgradeModal,
    feedbackEmailAddress,
    supportEmailAddress,
    upgradeModalCooldownDays,
    upgradeModalShowAtSessionNumber,
    feeReimbursementMemo,
    successIconDuration,
    appLockGracePeriodSeconds,
    cardTermsAndConditionsUrl,
    cardPrivacyPolicyUrl,
    cardCardholderAgreementUrl,
    cardESignConsentUrl,
    cardIssuerPrivacyPolicyUrl,
    cardSubscriptionPriceUsd,
    cardReplacementFeeUsd,
    cardUsdTransactionFeePercent,
    cardForeignTransactionFeePercent,
    cardMaxOverdraftUsd,
    cardLateRepaymentFeeUsd,
    replaceCardDeliveryConfig,
    sparkCompatibleWalletsUrl,
    cardInvestmentDepositBtcWalletId,
    backupNudgeBannerThreshold,
    backupNudgeModalThreshold,
    backupNudgeModalCooldownMs,
    nonCustodialEnabled,
    stableBalanceEnabled,
    btcMapPlacesEnabled,
    autoConvertMaxAttempts,
    autoConvertPollMaxAttempts,
    autoConvertPollIntervalMs,
    autoConvertAmountMatchToleranceBps,
    custodialFirstSignupBlockedCountries,
    selfCustodialDollarBalanceBlockedCountries,
    selfCustodialTransferBlockedCountries,
    selfCustodialCreationBlockedCountries,
    offboardOnlyCountries,
    selfCustodialDepositClaimLeewayVbyte,
    migrationReceiveDelayedNoticeMs,
    migrationDelayedRedirectEnabled,
    persistentBulletinsEnabled,
    custodialTwoFactorEnforcementEnabled,
    feeRatesConfig,
  }
}

export const FeatureFlagContext = createContext<FeatureFlags>(defaultFeatureFlags)
export const RemoteConfigContext = createContext<RemoteConfig>(defaultRemoteConfig)

export const FeatureFlagContextProvider: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  const [remoteConfig, setRemoteConfig] = useState<RemoteConfig>(readRemoteConfig)

  const { currentLevel } = useLevel()
  const [remoteConfigReady, setRemoteConfigReady] = useState(false)
  const rolloutLoggedRef = useRef(false)

  const {
    appConfig: { galoyInstance },
  } = useAppConfig()
  const hasCustodialAccount = useHasCustodialAccount()

  /** Read again whether or not the fetch lands: a fetch that fails, offline, still
   *  leaves Firebase holding what the device activated on an earlier launch, which the
   *  first read could not see while the shipped defaults were still being applied. */
  useEffect(() => {
    ;(async () => {
      try {
        await remoteConfigInstance().fetchAndActivate()
      } catch (err) {
        logError({
          scope: "remote-config",
          error: err,
          context: { stage: "fetchAndActivate" },
          dedupKey: "remote-config-fetch",
        })
      } finally {
        setRemoteConfig(readRemoteConfig())
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
