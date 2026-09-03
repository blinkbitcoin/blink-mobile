import { NavigatorScreenParams } from "@react-navigation/native"
import { LNURLPaySuccessAction } from "lnurl-pay"

import { IconNamesType } from "@app/components/atomic/galoy-icon"
import { PhoneCodeChannelType, UserContact, WalletCurrency } from "@app/graphql/generated"
import { EarnSectionType } from "@app/screens/earns-screen/sections"
import { PhoneLoginInitiateType } from "@app/screens/phone-auth-screen/phone-login-initiate-type"
import {
  PaymentDestination,
  MerchantChoice,
  ReceiveDestination,
} from "@app/screens/send-bitcoin-screen/payment-destination/index.types"
import { PaymentDetail } from "@app/screens/send-bitcoin-screen/payment-details/index.types"
import { PaymentSendCompletedStatus } from "@app/screens/send-bitcoin-screen/use-send-payment"
import { DrainConversionReturn } from "@app/screens/conversion-flow/drain-conversion"
import { AccountMode, AccountTypeMode, CreationBlockReason } from "@app/types/account"
import { DisplayCurrency, MoneyAmount, WalletOrDisplayCurrency } from "@app/types/amounts"
import { WalletDescriptor } from "@app/types/wallets"
import { MigrationSupportOrigin, MigrationSupportReason } from "@app/types/migration"

import { AuthenticationScreenPurpose, PinScreenPurpose } from "../utils/enum"

export const PhraseStep = { First: 1, Second: 2 } as const
export type PhraseStep = (typeof PhraseStep)[keyof typeof PhraseStep]

/** Deep links and navigation-state rehydration can deliver params the route type says are
 *  impossible; the phrase screens use this to fall back instead of throwing. */
export const isPhraseStep = (value: unknown): value is PhraseStep =>
  value === PhraseStep.First || value === PhraseStep.Second

export const ChooseExperienceContinueRoute = {
  AcceptTerms: "acceptTermsAndConditions",
  BackupSuccess: "selfCustodialBackupSuccess",
  BalancesOverview: "accountMigrationBalancesOverview",
} as const
export type ChooseExperienceContinueRoute =
  (typeof ChooseExperienceContinueRoute)[keyof typeof ChooseExperienceContinueRoute]

export const ChooseExperienceEntry = {
  Settings: "settings",
} as const
export type ChooseExperienceEntry =
  (typeof ChooseExperienceEntry)[keyof typeof ChooseExperienceEntry]

/** The onward step the onboarding entries carry. Derived off the route params so the two
 *  cannot drift, and null on the settings entry, which has no onward step at all. */
export type ChooseExperienceContinue = Extract<
  RootStackParamList["selfCustodialChooseExperience"],
  { onContinue: unknown }
>["onContinue"]

/** Whether the mode screen can offer a way back. Creation arrives from the account type
 *  screen with nothing provisioned yet, and settings opens it over a live session, so both
 *  have somewhere coherent to return to. Restore and migration arrive after the account is
 *  already activated, and only the screen ahead resets to Primary: going back there strands
 *  a live account on an onboarding screen. */
export const canGoBackFromChooseExperience = (
  onContinue: ChooseExperienceContinue | null,
): boolean => {
  if (!onContinue) return true

  return onContinue.route === ChooseExperienceContinueRoute.AcceptTerms
}

export type RootStackParamList = {
  getStarted: undefined
  accountTypeSelection: { mode: AccountTypeMode }
  unsupportedRegion: { reason?: CreationBlockReason } | undefined
  selfCustodialWalletCreation: { mode?: AccountMode } | undefined
  liteDeviceAccount: {
    appCheckToken: string
  }
  // Dev-only route: root-navigator registers it only when __DEV__ (lazy
  // require there). navigate("developerScreen") still type-checks in release
  // builds but is dropped as an unhandled action — gate any new call site
  // with __DEV__, or reuse useSecretMenuTrigger.
  developerScreen: undefined
  login: {
    type: PhoneLoginInitiateType
    title?: string
    onboarding?: boolean
  }
  /** `isResume` marks the lock raised on returning from background: unlocking pops back to
   *  the screen the user was on, instead of resetting to Primary the way a cold start does. */
  authenticationCheck: { isResume?: boolean } | undefined
  authentication: {
    screenPurpose: AuthenticationScreenPurpose
    isPinEnabled: boolean
    isResume?: boolean
  }
  pin: {
    screenPurpose: PinScreenPurpose
    isResume?: boolean
    /** ChallengePin only. Function params are non-serializable (the same accepted
     *  trade-off as selectionScreen.onSelect) and are dropped on state rehydration,
     *  so both stay optional and every call is optional-chained. */
    onChallengeSuccess?: () => void
    onChallengeFailure?: () => void
  }
  Primary: undefined
  earnsSection: { section: EarnSectionType; isAvailable: boolean }
  earnsQuiz: { id: string; isAvailable: boolean }
  scanningQRCode: undefined
  settings: undefined
  addressScreen: undefined
  defaultWallet: undefined
  theme: undefined
  sendBitcoinDestination?: {
    payment?: string
    username?: string
    scanPressed?: number
  }
  sendBitcoinDetails: {
    paymentDestination: PaymentDestination
  }
  merchantSelection: {
    merchants: MerchantChoice[]
  }
  sendBitcoinConfirmation: {
    paymentDetail: PaymentDetail<WalletCurrency>
  }
  conversionDetails: undefined
  conversionConfirmation: {
    fromWalletCurrency: WalletCurrency
    moneyAmount: MoneyAmount<WalletOrDisplayCurrency>
    /** Where a completed drain convert lands (back in its flow, not Home). Navigation-only,
     *  never a privilege: the region waiver comes from the armed flag, not this forgeable param. */
    drainConversion?: DrainConversionReturn | null
  }
  conversionSuccess:
    | {
        /** Set when the conversion drained a balance for a flow, so the success screen
         *  returns there instead of Home. */
        returnTo?: DrainConversionReturn
      }
    | undefined
  sendBitcoinCompleted: {
    arrivalAtMempoolEstimate?: number
    status: PaymentSendCompletedStatus
    successAction?: LNURLPaySuccessAction
    preimage?: string
    note?: string
    currencyAmount?: string
    satAmount?: string
    currencyFeeAmount?: string
    satFeeAmount?: string
    destination?: string
    paymentType?: string
    createdAt?: number
  }
  setLightningAddress: { onboarding?: boolean }
  language: undefined
  currency: undefined
  security: {
    mIsBiometricsEnabled: boolean
    mIsPinEnabled: boolean
  }
  lnurl: { username: string }
  sectionCompleted: { amount: number; sectionTitle: string; isAvailable: boolean }
  priceHistory: undefined
  receiveBitcoin: undefined
  redeemBitcoinDetail: {
    receiveDestination: ReceiveDestination
  }
  redeemBitcoinResult: {
    callback: string
    domain: string
    k1: string
    defaultDescription: string
    minWithdrawableSatoshis: MoneyAmount<typeof WalletCurrency.Btc>
    maxWithdrawableSatoshis: MoneyAmount<typeof WalletCurrency.Btc>
    receivingWalletDescriptor?: WalletDescriptor<typeof WalletCurrency.Btc>
    unitOfAccountAmount: MoneyAmount<WalletOrDisplayCurrency>
    settlementAmount: MoneyAmount<typeof WalletCurrency.Btc>
    displayAmount: MoneyAmount<DisplayCurrency>
  }
  phoneFlow: NavigatorScreenParams<PhoneValidationStackParamList>
  phoneRegistrationInitiate: undefined
  phoneRegistrationValidate: { phone: string; channel: PhoneCodeChannelType }
  transactionDetail: { txid: string; recipientUserId?: string }
  unclaimedDepositsScreen: undefined
  transactionHistory?: {
    wallets?: ReadonlyArray<{
      readonly id: string
      readonly walletCurrency: WalletCurrency
    }>
    currencyFilter?: WalletCurrency
    showLoading?: boolean
  }
  Earn: undefined
  accountScreen: undefined
  profileScreen: undefined
  notificationSettingsScreen: undefined
  apiScreen: undefined
  apiKeyCreateScreen: undefined
  transactionLimitsScreen: undefined
  feeRatesScreen: undefined
  acceptTermsAndConditions: NewAccountFlowParamsList
  emailRegistrationInitiate?: { onboarding?: boolean; hasUsername?: boolean }
  emailRegistrationValidate: {
    email: string
    emailRegistrationId: string
    onboarding?: boolean
    hasUsername?: boolean
  }
  emailLoginInitiate: undefined
  emailLoginValidate: { email: string; emailLoginId: string }
  totpRegistrationInitiate: undefined
  totpRegistrationValidate: { totpRegistrationId: string }
  totpLoginValidate: { authToken: string }
  webView: {
    url: string
    initialTitle?: string
    headerTitle?: string
    /**
     * DEV ONLY — bypasses the instance-origin allowlist of the WebView screen.
     * Must only be set from the developer screen; the webView route is not
     * deep-linkable, so the param cannot arrive from outside the app. That
     * invariant is enforced by a test over DEEP_LINK_SCREENS in
     * navigation-container-wrapper — adding a deep link for this route would
     * make the bypass reachable from a crafted URL.
     */
    allowArbitraryUrl?: boolean
  }
  fullOnboardingFlow: undefined
  notificationHistory: undefined
  onboarding: NavigatorScreenParams<OnboardingStackParamList>
  cardDashboardScreen: undefined
  cardFeeScheduleScreen: undefined
  cardAddToMobileWalletScreen: {
    lastFour: string
    holderName: string
  }
  cardDetailsScreen: undefined
  cardLimitsScreen: undefined
  cardPersonalDetailsScreen: undefined
  cardSettingsScreen: undefined
  cardStatementsScreen: undefined
  cardTransactionDetailsScreen: { transactionId: string }
  cardStatusScreen: {
    title: string
    subtitle: string
    buttonLabel: string
    navigateTo: keyof RootStackParamList
    iconName: IconNamesType
    iconColor?: string
    showCard?: boolean
    showAddToWallet?: boolean
    lastFour?: string
    holderName?: string
  }
  cardShippingAddressScreen: undefined
  cardCreatePinScreen: undefined
  cardChangePinScreen: undefined
  orderCardScreen: undefined
  replaceCardScreen: { cardId: string }
  selectionScreen: {
    title: string
    options: Array<{ value: string; label: string }>
    selectedValue: string
    onSelect: (value: string) => void
  }
  cardOnboardingIntroducingScreen: undefined
  cardOnboardingDetailsScreen: undefined
  cardOnboardingWelcomeScreen: undefined
  cardOnboardingSubscribeScreen: undefined
  cardOnboardingPaymentScreen: undefined
  cardOnboardingLoadingScreen: undefined
  cardOnboardingPersonalInfoScreen: undefined
  cardOnboardingAcknowledgementScreen: undefined
  cardOnboardingPreapprovedScreen: undefined
  cardOnboardingProcessingScreen: undefined
  cardOnboardingApprovedScreen: undefined
  selfCustodialBackupMethod: undefined
  selfCustodialCloudBackup: undefined
  selfCustodialBackupSecurityChecks: undefined
  selfCustodialBackupPhrase: { step: PhraseStep }
  selfCustodialViewBackupSecurityChecks: undefined
  selfCustodialViewBackupPhrase: undefined
  selfCustodialBackupPhraseConfirm: {
    challenges: Array<{ index: number; word: string }>
    successMessage?: string
  }
  selfCustodialBackupSuccess: { reBackup?: boolean; message?: string } | undefined
  /** The settings entry applies the choice to the active account and returns. The
   *  onboarding entries declare their onward step: restore and migration pass the
   *  account id (mode stored now); creation has none yet, so the mode rides to wallet
   *  creation instead. */
  selfCustodialChooseExperience:
    | {
        entry: typeof ChooseExperienceEntry.Settings
        /** Set when returning from the drain conversion, so the switch resumes preselected. */
        initialMode?: AccountMode
      }
    | {
        onContinue:
          | { route: typeof ChooseExperienceContinueRoute.AcceptTerms }
          | {
              route: typeof ChooseExperienceContinueRoute.BackupSuccess
              accountId: string
            }
          | {
              route: typeof ChooseExperienceContinueRoute.BalancesOverview
              accountId: string
            }
      }
  selfCustodialModeSwitchSuccess: { mode: AccountMode }
  accountMigrationEntry: undefined
  accountMigrationStart: undefined
  accountMigrationExplainer: undefined
  accountMigrationKeepReceiving: undefined
  accountMigrationMerchantTools: undefined
  accountMigrationDownloadHistory: undefined
  accountMigrationBalancesOverview: undefined
  accountMigrationTransferringFunds: undefined
  accountMigrationContactSupport: {
    reason: MigrationSupportReason
    origin?: MigrationSupportOrigin
    /** Named by a handover raised after the session was discarded, when the live `me` query
     *  can no longer answer for the custodial account the ticket is about. */
    custodialAccountId?: string
  }
  selfCustodialRestorePhrase: { step: PhraseStep; words?: string[] }
  selfCustodialRestoreMethod: undefined
  selfCustodialCloudRestore: undefined
  stableBalanceSettings: undefined
}

export type OnboardingStackParamList = {
  welcomeLevel1: { onboarding?: boolean }
  emailBenefits: { onboarding?: boolean; hasUsername?: boolean }
  lightningBenefits: { onboarding?: boolean; canGoBack?: boolean }
  supportScreen?: { canGoBack?: boolean }
}

export type PeopleStackParamList = {
  peopleHome: undefined
  contactDetail: { contact: UserContact }
  circlesDashboard: undefined
  allContacts: undefined
}

export type PhoneValidationStackParamList = {
  Primary: undefined
  phoneLoginInitiate: {
    type: PhoneLoginInitiateType
    channel: PhoneCodeChannelType
    title?: string
    onboarding?: boolean
  }
  telegramLoginValidate: {
    phone: string
    type: PhoneLoginInitiateType
    onboarding?: boolean
  }
  phoneLoginValidate: {
    phone: string
    channel: PhoneCodeChannelType
    type: PhoneLoginInitiateType
    onboarding?: boolean
  }
  authentication: {
    screenPurpose: AuthenticationScreenPurpose
  }
  Home: undefined
  totpLoginValidate: { authToken: string }
}

export type PrimaryStackParamList = {
  Home: undefined
  People: undefined
  Map: undefined
  Earn: undefined
  Web: undefined
}

export type NewAccountFlowParamsList = {
  flow: "phone" | "trial" | "selfCustodial" | "migration"
  /** The self-custodial region mode chosen before terms, carried through to wallet
   *  creation, which stores it against the account it provisions. */
  mode?: AccountMode
}
