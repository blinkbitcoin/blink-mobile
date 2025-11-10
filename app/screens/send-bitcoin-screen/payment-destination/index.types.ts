import { LnUrlPayServiceResponse } from "lnurl-pay"

import {
  AccountDefaultWalletLazyQueryHookResult,
  Network,
  WalletCurrency,
} from "@app/graphql/generated"
import { WalletDescriptor } from "@app/types/wallets"
import {
  IntraledgerPaymentDestination,
  LightningPaymentDestination,
  LnurlPaymentDestination,
  OnchainPaymentDestination,
  ParsedPaymentDestination,
  PaymentType,
  InputSource,
} from "@blinkbitcoin/blink-client"

import { ConvertMoneyAmount, PaymentDetail } from "../payment-details"

export type ParseDestinationResult = Destination | InvalidDestination

export type ParseDestinationParams = {
  rawInput: string
  myWalletIds: string[]
  bitcoinNetwork: Network
  lnurlDomains: string[]
  accountDefaultWalletQuery: AccountDefaultWalletLazyQueryHookResult[0]
  inputSource?: InputSource
  displayCurrency?: string
}

export const DestinationDirection = {
  Send: "Send",
  Receive: "Receive",
} as const

export type DestinationDirection =
  (typeof DestinationDirection)[keyof typeof DestinationDirection]

export type Destination = PaymentDestination | ReceiveDestination

export type PaymentDestination = {
  valid: true
  validDestination: ValidParsedPaymentDestination
  destinationDirection: typeof DestinationDirection.Send
  createPaymentDetail: <T extends WalletCurrency>(
    params: CreatePaymentDetailParams<T>,
  ) => PaymentDetail<T>
}

export type CreatePaymentDetailParams<T extends WalletCurrency> = {
  convertMoneyAmount: ConvertMoneyAmount
  sendingWalletDescriptor: WalletDescriptor<T>
}

export type ReceiveDestination = {
  valid: true
  validDestination: ValidParsedReceiveDestination
  destinationDirection: typeof DestinationDirection.Receive
}

export type InvalidDestination = {
  valid: false
  invalidPaymentDestination: ParsedPaymentDestination
  invalidReason: InvalidDestinationReason
}

export const InvalidDestinationReason = {
  UnknownDestination: "UnknownDestination",
  InvoiceExpired: "InvoiceExpired",
  WrongNetwork: "WrongNetwork",
  InvalidAmount: "InvalidAmount",
  UsernameDoesNotExist: "UsernameDoesNotExist",
  SelfPayment: "SelfPayment",
  LnurlUnsupported: "LnurlUnsupported",
  LnurlError: "LnurlError",
  UnknownLightning: "UnknownLightning",
  UnknownOnchain: "UnknownOnchain",
  WrongDomain: "WrongDomain",
} as const

export type InvalidDestinationReason =
  (typeof InvalidDestinationReason)[keyof typeof InvalidDestinationReason]

export type ValidParsedPaymentDestination = (
  | ResolvedLnurlPaymentDestination
  | LightningPaymentDestination
  | OnchainPaymentDestination
  | ResolvedIntraledgerPaymentDestination
) & { valid: true }

export type ResolvedIntraledgerPaymentDestination = IntraledgerPaymentDestination & {
  valid: true
} & { walletId: string }

export type ResolvedLnurlPaymentDestination = LnurlPaymentDestination & {
  lnurlParams: LnUrlPayServiceResponse
}

export type ValidParsedReceiveDestination = LnurlWithdrawDestination

export type LnurlWithdrawDestination = {
  paymentType: typeof PaymentType.Lnurl
  valid: true
  lnurl: string
  callback: string
  domain: string
  k1: string
  defaultDescription: string
  minWithdrawable: number
  maxWithdrawable: number
}
