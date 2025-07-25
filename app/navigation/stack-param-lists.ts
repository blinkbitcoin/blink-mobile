import { LNURLPaySuccessAction } from "lnurl-pay/dist/types/types"
import { PhoneCodeChannelType, UserContact, WalletCurrency } from "@app/graphql/generated"
import { EarnSectionType } from "@app/screens/earns-screen/sections"
import { PhoneLoginInitiateType } from "@app/screens/phone-auth-screen"
import {
  PaymentDestination,
  ReceiveDestination,
} from "@app/screens/send-bitcoin-screen/payment-destination/index.types"
import { PaymentDetail } from "@app/screens/send-bitcoin-screen/payment-details/index.types"
import { PaymentSendCompletedStatus } from "@app/screens/send-bitcoin-screen/use-send-payment"
import { DisplayCurrency, MoneyAmount, WalletOrDisplayCurrency } from "@app/types/amounts"
import { WalletDescriptor } from "@app/types/wallets"
import { NavigatorScreenParams } from "@react-navigation/native"

import { AuthenticationScreenPurpose, PinScreenPurpose } from "../utils/enum"

export type RootStackParamList = {
  getStarted: undefined
  liteDeviceAccount: {
    appCheckToken: string
  }
  developerScreen: undefined
  login: {
    type: PhoneLoginInitiateType
    title?: string
    onboarding?: boolean
  }
  authenticationCheck: undefined
  authentication: {
    screenPurpose: AuthenticationScreenPurpose
    isPinEnabled: boolean
  }
  pin: { screenPurpose: PinScreenPurpose }
  Primary: undefined
  earnsSection: { section: EarnSectionType }
  earnsQuiz: { id: string }
  scanningQRCode: undefined
  settings: undefined
  addressScreen: undefined
  defaultWallet: undefined
  theme: undefined
  sendBitcoinDestination?: {
    payment?: string
    username?: string
  }
  sendBitcoinDetails: {
    paymentDestination: PaymentDestination
  }
  sendBitcoinConfirmation: {
    paymentDetail: PaymentDetail<WalletCurrency>
  }
  conversionDetails: undefined
  conversionConfirmation: {
    fromWalletCurrency: WalletCurrency
    moneyAmount: MoneyAmount<WalletOrDisplayCurrency>
  }
  conversionSuccess: undefined
  sendBitcoinCompleted: {
    arrivalAtMempoolEstimate?: number
    status: PaymentSendCompletedStatus
    successAction?: LNURLPaySuccessAction
    preimage?: string
  }
  setLightningAddress: { onboarding?: boolean }
  language: undefined
  currency: undefined
  security: {
    mIsBiometricsEnabled: boolean
    mIsPinEnabled: boolean
  }
  lnurl: { username: string }
  sectionCompleted: { amount: number; sectionTitle: string }
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
    receivingWalletDescriptor: WalletDescriptor<typeof WalletCurrency.Btc>
    unitOfAccountAmount: MoneyAmount<WalletOrDisplayCurrency>
    settlementAmount: MoneyAmount<typeof WalletCurrency.Btc>
    displayAmount: MoneyAmount<DisplayCurrency>
  }
  phoneFlow: NavigatorScreenParams<PhoneValidationStackParamList>
  phoneRegistrationInitiate: undefined
  phoneRegistrationValidate: { phone: string; channel: PhoneCodeChannelType }
  transactionDetail: { txid: string }
  transactionHistory?: undefined
  Earn: undefined
  accountScreen: undefined
  notificationSettingsScreen: undefined
  transactionLimitsScreen: undefined
  acceptTermsAndConditions: NewAccountFlowParamsList
  emailRegistrationInitiate?: { onboarding?: boolean }
  emailRegistrationValidate: {
    email: string
    emailRegistrationId: string
    onboarding?: boolean
  }
  emailLoginInitiate: undefined
  emailLoginValidate: { email: string; emailLoginId: string }
  totpRegistrationInitiate: undefined
  totpRegistrationValidate: { totpRegistrationId: string }
  totpLoginValidate: { authToken: string }
  webView: { url: string; initialTitle?: string }
  fullOnboardingFlow: undefined
  supportChat: undefined
  notificationHistory: undefined
  onboarding: NavigatorScreenParams<OnboardingStackParamList>
}

export type OnboardingStackParamList = {
  welcomeLevel1: { onboarding?: boolean }
  emailBenefits: { onboarding?: boolean }
  emailConfirmed: { onboarding?: boolean }
  lightningBenefits: { onboarding?: boolean }
  lightningConfirmed: { onboarding?: boolean }
  supportScreen: undefined
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

export type NewAccountFlowParamsList = { flow: "phone" | "trial" }
