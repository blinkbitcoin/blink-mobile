import { Platform } from "react-native"

import { WalletAddResult, type CardholderAddress, type DeviceWallet } from "../types"
import type { GooglePayAddress, MeaWalletSdk } from "./meawallet-sdk"

/** Apple reports the user or the system dismissing its sheet under this domain, with
 *  codes 1 (user) and 2 (system). React Native hands the NSError's domain to JS beside its
 *  code, so the match does not depend on how the SDK words the message. */
const APPLE_ADD_PASS_ERROR_DOMAIN = "PKAddPaymentPassErrorDomain"
const APPLE_CANCEL_CODES: readonly string[] = ["1", "2"]

const isAppleSheetDismissed = (err: unknown): boolean => {
  if (!(err instanceof Error)) return false
  const { code, domain } = err as Error & { code?: string; domain?: string }
  const isCancelCode = code !== undefined && APPLE_CANCEL_CODES.includes(code)
  return isCancelCode && domain === APPLE_ADD_PASS_ERROR_DOMAIN
}

/** The SDK names its errors in `code`, and reports the user backing out of Google's sheet,
 *  or out of creating a Google Wallet on the way, under this one. Anything else the wallet
 *  answers is a GOOGLE_PAY_ERROR carrying the wallet's own code. */
const GOOGLE_CANCEL_CODE = "OPERATION_CANCELLED_BY_USER"

/**
 * Google Wallet keeps a token for a card it took, and also for one it never finished: a
 * token waiting on identity verification stays when the user leaves Google's check before
 * finishing it. Only a token that holds the card counts as the card being there, and one
 * still being provisioned does too, so a second add does not race it. The tokens are
 * found by the card's last four digits, so one an older card with the same digits left
 * behind counts the same. Adding again pushes the card anew; finishing the waiting token
 * through the SDK's tokenize call needs a run on a device with real provisioning data.
 */
const GOOGLE_HELD_TOKEN_STATES: readonly string[] = [
  "TOKEN_STATE_ACTIVE",
  "TOKEN_STATE_SUSPENDED",
  "TOKEN_STATE_PENDING",
]

const isGoogleSheetDismissed = (err: unknown): boolean => {
  if (!(err instanceof Error)) return false
  const { code } = err as Error & { code?: string }
  return code === GOOGLE_CANCEL_CODE
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
    const isCardHeld = tokens.some(({ tokenState }) =>
      GOOGLE_HELD_TOKEN_STATES.includes(tokenState),
    )
    return !isCardHeld
  },
  add: async (card, data) => {
    try {
      await sdk.googlePay.push(
        sdk.cardWithSecret(card.cardId, data.cardSecret),
        data.displayName,
        toGooglePayAddress(data.address),
      )
      return WalletAddResult.Added
    } catch (err) {
      if (isGoogleSheetDismissed(err)) return WalletAddResult.Cancelled
      throw err
    }
  },
})

export const deviceWalletFor = (sdk: MeaWalletSdk): DeviceWallet =>
  Platform.OS === "ios" ? appleWallet(sdk) : googleWallet(sdk)
