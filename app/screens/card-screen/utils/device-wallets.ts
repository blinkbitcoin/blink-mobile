import { Platform } from "react-native"

import { WalletAddResult, type CardholderAddress, type DeviceWallet } from "../types"
import type { GooglePayAddress, MeaWalletSdk } from "./meawallet-sdk"

/** Apple reports the user or the system dismissing its sheet under this domain, with
 *  codes 1 (user) and 2 (system); the SDK passes the NSError through as the message. */
const APPLE_ADD_PASS_ERROR_DOMAIN = "PKAddPaymentPassErrorDomain"
const APPLE_CANCEL_CODES: readonly string[] = ["1", "2"]

const isAppleSheetDismissed = (err: unknown): boolean => {
  if (!(err instanceof Error)) return false
  const { code } = err as Error & { code?: string }
  const isCancelCode = code !== undefined && APPLE_CANCEL_CODES.includes(code)
  return isCancelCode && err.message.includes(APPLE_ADD_PASS_ERROR_DOMAIN)
}

const toGooglePayAddress = (address: CardholderAddress): GooglePayAddress => ({
  name: address.name,
  address1: address.line1,
  address2: address.line2,
  locality: address.city,
  administrativeArea: address.region,
  postalCode: address.postalCode,
  countryCode: address.countryCode,
  phoneNumber: address.phoneNumber,
})

const appleWallet = (sdk: MeaWalletSdk): DeviceWallet => ({
  canAdd: async (card) => {
    const canAddPasses = await sdk.applePay.canAddPaymentPass()
    if (!canAddPasses) return false
    return sdk.applePay.canAddPaymentPassWithPrimaryAccountNumberSuffix(card.lastFour)
  },
  add: async (card, data) => {
    const tokenization = await sdk.applePay.initializeOemTokenization(
      sdk.cardWithSecret(card.cardId, data.cardSecret),
    )
    try {
      /** Whatever activation state the pass comes back in, Apple Pay now holds it. */
      await sdk.applePay.showAddPaymentPassView(tokenization)
      return WalletAddResult.Added
    } catch (err) {
      if (isAppleSheetDismissed(err)) return WalletAddResult.Cancelled
      throw err
    }
  },
})

const googleWallet = (sdk: MeaWalletSdk): DeviceWallet => ({
  canAdd: async (card) => {
    const isAvailable = await sdk.googlePay.isWalletAvailable()
    if (!isAvailable) return false
    const tokens = await sdk.googlePay.checkWalletForCardSuffix(card.lastFour)
    return tokens.length === 0
  },
  add: async (card, data) => {
    await sdk.googlePay.push(
      sdk.cardWithSecret(card.cardId, data.cardSecret),
      data.displayName,
      toGooglePayAddress(data.address),
    )
    return WalletAddResult.Added
  },
})

export const deviceWalletFor = (sdk: MeaWalletSdk): DeviceWallet =>
  Platform.OS === "ios" ? appleWallet(sdk) : googleWallet(sdk)
