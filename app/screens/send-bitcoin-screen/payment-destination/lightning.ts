import { WalletCurrency } from "@app/graphql/generated"
import { ZeroBtcMoneyAmount, toBtcMoneyAmount } from "@app/types/amounts"
import {
  InvalidLightningDestinationReason,
  LightningPaymentDestination,
} from "@blinkbitcoin/blink-client"

import {
  createAmountLightningPaymentDetails,
  createNoAmountLightningPaymentDetails,
} from "../payment-details"
import {
  CreatePaymentDetailParams,
  DestinationDirection,
  InvalidDestinationReason,
  ParseDestinationResult,
  PaymentDestination,
} from "./index.types"

export const resolveLightningDestination = (
  parsedLightningDestination: LightningPaymentDestination,
): ParseDestinationResult => {
  if (parsedLightningDestination.valid === true) {
    return createLightningDestination(parsedLightningDestination)
  }

  return {
    valid: false,
    invalidPaymentDestination: parsedLightningDestination,
    invalidReason: mapInvalidReason(parsedLightningDestination.invalidReason),
  }
}

export const createLightningDestination = (
  parsedLightningDestination: LightningPaymentDestination & { valid: true },
): PaymentDestination => {
  const { paymentRequest, amount, memo } = parsedLightningDestination

  let createPaymentDetail

  if (amount) {
    createPaymentDetail = <T extends WalletCurrency>({
      convertMoneyAmount,
      sendingWalletDescriptor,
    }: CreatePaymentDetailParams<T>) => {
      return createAmountLightningPaymentDetails({
        paymentRequest,
        sendingWalletDescriptor,
        paymentRequestAmount: toBtcMoneyAmount(amount),
        convertMoneyAmount,
        destinationSpecifiedMemo: memo,
      })
    }
  } else {
    createPaymentDetail = <T extends WalletCurrency>({
      convertMoneyAmount,
      sendingWalletDescriptor,
    }: CreatePaymentDetailParams<T>) => {
      return createNoAmountLightningPaymentDetails({
        paymentRequest,
        sendingWalletDescriptor,
        convertMoneyAmount,
        destinationSpecifiedMemo: memo,
        unitOfAccountAmount: ZeroBtcMoneyAmount,
      })
    }
  }

  return {
    valid: true,
    destinationDirection: DestinationDirection.Send,
    validDestination: parsedLightningDestination,
    createPaymentDetail,
  }
}

const mapInvalidReason = (
  invalidLightningReason: InvalidLightningDestinationReason,
): InvalidDestinationReason => {
  switch (invalidLightningReason) {
    case InvalidLightningDestinationReason.InvoiceExpired:
      return InvalidDestinationReason.InvoiceExpired
    case InvalidLightningDestinationReason.WrongNetwork:
      return InvalidDestinationReason.WrongNetwork
    case InvalidLightningDestinationReason.Unknown:
      return InvalidDestinationReason.UnknownLightning
  }
}
