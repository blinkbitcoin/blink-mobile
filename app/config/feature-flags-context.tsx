import React, { createContext, useContext, useEffect, useRef, useState } from "react"
import { AppState, AppStateStatus } from "react-native"
import remoteConfigInstance from "@react-native-firebase/remote-config"

import {
  isUsableThresholdSet,
  thresholdsFromConsole,
  toWalletThresholds,
} from "@app/custodial/two-factor-enforcement"
import { useLevel } from "@app/graphql/level-context"
import { useAppConfig } from "@app/hooks/use-app-config"
import { useBackoffRetry } from "@app/hooks/use-backoff-retry"
import { useHasCustodialAccount } from "@app/hooks/use-has-custodial-account"
import { logSelfCustodialRolloutExposed } from "@app/self-custodial/analytics"
import {
  TwoFactorConsoleThresholds,
  TwoFactorThresholds,
} from "@app/types/two-factor-enforcement"
import { logError } from "@app/utils/log-error"
import {
  getRemoteConfigNumericObject,
  getRemoteConfigObject,
  getRemoteConfigPositiveNumber,
  getRemoteConfigStringList,
  serializeRemoteConfigDefault,
} from "@app/utils/remote-config"
import { withTimeout } from "@app/utils/with-timeout"

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
const CustodialTwoFactorThresholdsKey = "custodialTwoFactorThresholds"
const FeeRatesConfigKey = "feeRatesConfig"
const InactivityFeeEnabledKey = "inactivityFeeEnabled"
const CloudBundleStaleAfterMsKey = "cloudBundleStaleAfterMs"

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
  /** The raw value, on by default so onboarding can offer self-custodial before the
   *  console answers. A kill switch reads it together with `isNonCustodialFlagSettled`,
   *  or it stays open on every device the console never reached. */
  nonCustodialEnabled: boolean
  stableBalanceEnabled: boolean
  remoteConfigReady: boolean
  /** Whether `nonCustodialEnabled` holds a value the console set, fetched on this launch
   *  or activated on an earlier one. Off, it is the shipped default, which says nothing
   *  about the console: the fetch failed, or the console left the flag unset. */
  isNonCustodialFlagSettled: boolean
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
  [CustodialTwoFactorThresholdsKey]: TwoFactorThresholds
  [FeeRatesConfigKey]: FeeRatesConfig
  [InactivityFeeEnabledKey]: boolean
  [CloudBundleStaleAfterMsKey]: number
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

/** The two-factor tiers as shipped, as the console writes them: 50,000 sats or $50 for
 *  the suggested tier, 500,000 sats or $500 for the recommended tier, 5,000,000 sats or
 *  $5,000 for the enforced tier. */
export const defaultTwoFactorConsoleThresholds: TwoFactorConsoleThresholds = {
  suggestedSats: 50_000,
  suggestedUsd: 50,
  recommendedSats: 500_000,
  recommendedUsd: 500,
  enforcedSats: 5_000_000,
  enforcedUsd: 5_000,
}

/** The same tiers in the wallets' own units, dollars in cents. */
export const defaultTwoFactorThresholds: TwoFactorThresholds = toWalletThresholds(
  defaultTwoFactorConsoleThresholds,
)

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
  /** Shipped on, because a first launch that cannot reach Firebase reads this value and
   *  nothing else: off, it left a new install with custodial signup alone, which many
   *  regions refuse. The console can still turn it off on every device that fetches, and
   *  a failed fetch keeps retrying until one does. */
  nonCustodialEnabled: true,
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
  custodialTwoFactorThresholds: defaultTwoFactorThresholds,
  feeRatesConfig: defaultFeeRatesConfig,
  /** Whether the fee rates screen lists the inactivity fee. Visibility only: the
   *  amount comes from `globals.feesInformation.inactivityFee`, the same config the
   *  backend charges from, so it is never priced here (blink-wip#1200). */
  inactivityFeeEnabled: true,
  /** How long the cloud copy of the emergency bundle may trail the one on the device
   *  before the home says so. An upload lands within seconds, so a week behind means
   *  uploads stopped: a lapsed sign-in, or the cloud drive turned off (#4337). */
  cloudBundleStaleAfterMs: 7 * 24 * 60 * 60 * 1000,
}

const defaultFeatureFlags: FeatureFlags = {
  deviceAccountEnabled: false,
  nonCustodialEnabled: false,
  stableBalanceEnabled: false,
  remoteConfigReady: false,
  isNonCustodialFlagSettled: false,
}

/** Applied asynchronously: until it lands Firebase reports every key as static, values it
 *  activated on an earlier launch included. */
const defaultsApplied = Promise.resolve(
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
    custodialTwoFactorThresholds: serializeRemoteConfigDefault(
      defaultTwoFactorConsoleThresholds,
    ),
    feeRatesConfig: serializeRemoteConfigDefault(defaultFeeRatesConfig),
  }),
)

/** A fetch that has not answered in this long settles as failed, and the app goes on
 *  with what an earlier launch activated: what waits on the fetch, as the two-factor
 *  tiers do, must not wait out Firebase's own minute on a weak connection. */
const FETCH_TIMEOUT_MS = 10_000

/** The waits between asks while the console has never answered: twice the last each time
 *  up to a minute, for about a quarter of an hour of waiting, so a network that never lets
 *  Firebase through does not wake the radio every minute for as long as the app lives. A
 *  server that answers with errors is already held off by the SDK's own backoff, which
 *  refuses the fetch on the device until it ends. */
const FETCH_RETRY_DELAYS_MS: readonly number[] = [
  2_000,
  4_000,
  8_000,
  16_000,
  32_000,
  ...Array<number>(14).fill(60_000),
]

/** How long a settled fetch waits for the shipped defaults. Until they land Firebase
 *  reports every key as static, values an earlier launch activated included, so a read
 *  before them shows the bare defaults; a native call that never answers must still not
 *  hold the app on a blank screen. */
const DEFAULTS_WAIT_MS = 1_000

/** Whether a fetch ever landed, on this launch or an earlier one. Firebase keeps -1 until
 *  a native call hands over the time of the last one, which a wait for the defaults that
 *  ran out may not have seen yet, so it is read again whenever it decides anything. */
const hasEverFetched = (): boolean => remoteConfigInstance().fetchTimeMillis > 0

const waitForShippedDefaults = (): Promise<void> =>
  withTimeout(defaultsApplied, DEFAULTS_WAIT_MS, "setDefaults").then(
    () => undefined,
    () => undefined,
  )

/** Asks for the console's values and activates them, true once they landed. Only the
 *  launch's first failure is reported: every report also leaves a Crashlytics breadcrumb,
 *  and a retry every minute would bury the ones that lead up to a real crash. A call that
 *  throws before it hands back a promise fails the same way, or the first launch would
 *  never mark the config ready and would stay on an empty screen. */
const fetchConsoleConfig = async ({
  isReported,
}: {
  isReported: boolean
}): Promise<boolean> => {
  try {
    await remoteConfigInstance().fetchAndActivate()
    return true
  } catch (err) {
    if (isReported) {
      logError({
        scope: "remote-config",
        error: err,
        context: { stage: "fetchAndActivate" },
        dedupKey: "remote-config-fetch",
      })
    }
    return false
  }
}

remoteConfigInstance().setConfigSettings({
  minimumFetchIntervalMillis: 0,
  fetchTimeMillis: FETCH_TIMEOUT_MS,
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

/** Whether Firebase holds a value the console set for the key, activated on this
 *  launch or an earlier one, rather than the shipped default. */
const isFromConsole = (key: string): boolean =>
  remoteConfigInstance().getValue(key).getSource() === "remote"

/** The tier thresholds as the console sets them, read and checked once, as a set: a
 *  set the two-factor rules cannot use, incomplete or out of bounds, falls back to the
 *  shipped one as a whole, and is reported. Mixing a console value with a shipped one
 *  could pass every check and still not be a set anyone wrote. */
const readTwoFactorThresholds = (): TwoFactorThresholds => {
  const value = getRemoteConfigObject<Record<string, unknown>>(
    CustodialTwoFactorThresholdsKey,
    defaultTwoFactorConsoleThresholds,
  )
  const thresholds = thresholdsFromConsole(value)
  const isUsable =
    thresholds !== null && isUsableThresholdSet(thresholds, defaultTwoFactorThresholds)
  if (isUsable) return thresholds
  logError({
    scope: "remote-config",
    error: new Error(`Thresholds in "${CustodialTwoFactorThresholdsKey}" are not usable`),
    context: { key: CustodialTwoFactorThresholdsKey, value },
  })
  return defaultTwoFactorThresholds
}

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

  /** The console's value or this build's default, never a default an earlier build left
   *  on disk: Android serves those until this build's own land, and earlier builds shipped
   *  it off, which is the custodial-only onboarding this default exists to prevent. */
  const nonCustodialEnabled = isFromConsole(NonCustodialEnabledKey)
    ? readBoolean(NonCustodialEnabledKey, defaultRemoteConfig.nonCustodialEnabled)
    : defaultRemoteConfig.nonCustodialEnabled

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

  const custodialTwoFactorThresholds = readTwoFactorThresholds()

  const feeRatesConfig = getRemoteConfigNumericObject(
    FeeRatesConfigKey,
    defaultFeeRatesConfig,
  )

  const inactivityFeeEnabled = readBoolean(
    InactivityFeeEnabledKey,
    defaultRemoteConfig.inactivityFeeEnabled,
  )

  const cloudBundleStaleAfterMs = getRemoteConfigPositiveNumber(
    CloudBundleStaleAfterMsKey,
    defaultRemoteConfig.cloudBundleStaleAfterMs,
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
    custodialTwoFactorThresholds,
    feeRatesConfig,
    inactivityFeeEnabled,
    cloudBundleStaleAfterMs,
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
  /** Whether `nonCustodialEnabled` is the console's: activated on an earlier launch,
   *  which cannot change before this launch's fetch settles and is readable once the
   *  shipped defaults land, or by that fetch. Anything else is the shipped default, which
   *  says nothing about the console: the fetch failed, or the console left it unset. */
  const [isNonCustodialFlagSettled, setIsNonCustodialFlagSettled] = useState(() =>
    isFromConsole(NonCustodialEnabledKey),
  )
  const rolloutLoggedRef = useRef(false)

  const {
    appConfig: { galoyInstance },
  } = useAppConfig()
  const hasCustodialAccount = useHasCustodialAccount()
  const { schedule: scheduleFetchRetry } = useBackoffRetry(FETCH_RETRY_DELAYS_MS)

  /** Read again whether or not the fetch lands: a fetch that fails, offline, still
   *  leaves Firebase holding what the device activated on an earlier launch, which the
   *  first read could not see while the shipped defaults were still being applied. */
  useEffect(() => {
    let isMounted = true
    /** Once the shipped defaults land, what an earlier launch activated is readable:
     *  the config is read again from it, so the flag that says it is the console's
     *  never runs ahead of the values it vouches for. */
    defaultsApplied
      .then(() => {
        if (!isMounted) return
        setRemoteConfig(readRemoteConfig())
        setIsNonCustodialFlagSettled(isFromConsole(NonCustodialEnabledKey))
      })
      .catch((err) =>
        logError({
          scope: "remote-config",
          error: err,
          context: { stage: "setDefaults" },
        }),
      )
    return () => {
      isMounted = false
    }
  }, [])

  /** Asks the console once per launch, and again while it has never answered: the shipped
   *  defaults are all a first launch offline has, until the app restarts or a retry lands. */
  useEffect(() => {
    let isMounted = true
    let hasFetched = false
    let isFetching = false
    let isAwaitingConsole = false

    /** The values and the flag that vouches for them are read together, so one never
     *  runs ahead of the other. */
    const readConsoleConfig = () => {
      setRemoteConfig(readRemoteConfig())
      setIsNonCustodialFlagSettled(isFromConsole(NonCustodialEnabledKey))
    }

    const fetchConfig = async () => {
      const isFirstFetch = !hasFetched
      hasFetched = true
      isFetching = true
      const [isFetched] = await Promise.all([
        fetchConsoleConfig({ isReported: isFirstFetch }),
        waitForShippedDefaults(),
      ])
      isFetching = false
      if (!isMounted) return

      /** A failed retry activated nothing, and a new object would re-render the whole tree
       *  to show the same values. */
      const shouldReadConfig = isFetched || isFirstFetch
      if (shouldReadConfig) {
        readConsoleConfig()
        setRemoteConfigReady(true)
      }

      /** Only a device that has never fetched keeps asking. One that fetched on an earlier
       *  launch already runs on the console's values, and swapping them mid-session would
       *  move the ground under decisions already made from them. */
      isAwaitingConsole = !isFetched && !hasEverFetched()
      if (isAwaitingConsole) scheduleFetchRetry(fetchIfStillAwaiting)
    }

    /** One ask at a time, and none once the console has answered: both a retry timer and a
     *  return to the app ask through here, and either may find the other already done. An
     *  earlier launch's fetch that only became readable after the first read means the
     *  console did answer, so its values are read rather than asked for. */
    const fetchIfStillAwaiting = () => {
      if (!isAwaitingConsole) return
      if (hasEverFetched()) {
        isAwaitingConsole = false
        readConsoleConfig()
        return
      }
      if (!isFetching) fetchConfig()
    }

    /** Back from the background the user may have just fixed the connection, and the
     *  retries may have run out while the app was away, so a device still waiting asks at
     *  once. It asks once without restarting the waits: Android reports the background
     *  for every screen laid over the app, as the camera or the share sheet, and an
     *  inactive moment, as an unlock prompt, does not count at all. */
    let appState = AppState.currentState
    const fetchOnReturn = (nextAppState: AppStateStatus) => {
      const isInactiveMoment = nextAppState === "inactive"
      if (isInactiveMoment) return
      const wasInBackground = appState === "background"
      const isNowActive = nextAppState === "active"
      appState = nextAppState
      const isReturningFromBackground = wasInBackground && isNowActive
      if (isReturningFromBackground) fetchIfStillAwaiting()
    }

    fetchConfig()
    const subscription = AppState.addEventListener("change", fetchOnReturn)
    return () => {
      isMounted = false
      subscription.remove()
    }
  }, [scheduleFetchRetry])

  /** The console's word, not the shipped default: the default turns self-custodial on so a
   *  first launch can offer it, but what builds on it must still go dark when the console
   *  turns it off on a device whose fetch never landed. */
  const isNonCustodialEnabledByConsole =
    isNonCustodialFlagSettled && remoteConfig.nonCustodialEnabled

  const featureFlags: FeatureFlags = {
    deviceAccountEnabled:
      remoteConfig.deviceAccountEnabledRestAuth || galoyInstance.id === "Local",
    nonCustodialEnabled: remoteConfig.nonCustodialEnabled,
    stableBalanceEnabled:
      isNonCustodialEnabledByConsole && remoteConfig.stableBalanceEnabled,
    remoteConfigReady,
    isNonCustodialFlagSettled,
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
