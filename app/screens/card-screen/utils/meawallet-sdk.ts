import { recordAppError, toError } from "@app/utils/error-reporting"

/** Card data as the SDK builds it for a wallet call; the app only passes it along. */
type MppCardData = { readonly type: string }

/** The cardholder's address Google Pay asks for when it takes a card. */
export type GooglePayAddress = {
  name: string
  address1: string
  address2?: string
  locality: string
  administrativeArea: string
  postalCode: string
  countryCode: string
  phoneNumber: string
}

/** What Apple Pay answers to start adding a card, handed back to show its sheet. */
type AppleOemTokenization = { readonly tokenizationReceipt: string }

/** Written as methods, as the SDK declares them: what the app passes back is data the SDK
 *  itself made, so its parameters are matched either way rather than only one. */
type ApplePayModule = {
  canAddPaymentPass(): Promise<boolean>
  canAddPaymentPassWithPrimaryAccountNumberSuffix(suffix: string): Promise<boolean>
  initializeOemTokenization(card: MppCardData): Promise<AppleOemTokenization>
  showAddPaymentPassView(tokenization: AppleOemTokenization): Promise<string>
}

/** A token Google Wallet holds for a card; the app reads only its state. */
type GoogleWalletToken = { readonly tokenState: string }

type GooglePayModule = {
  isWalletAvailable(): Promise<boolean>
  /** The tokens Google Wallet holds for cards ending in these digits. */
  checkWalletForCardSuffix(suffix: string): Promise<readonly GoogleWalletToken[]>
  /** Answers what it pushed, which the app does not read. */
  push(card: MppCardData, displayName: string, address: GooglePayAddress): Promise<object>
}

export type MeaWalletSdk = {
  applePay: ApplePayModule
  googlePay: GooglePayModule
  cardWithSecret: (cardId: string, cardSecret: string) => MppCardData
}

/**
 * The slice of `@meawallet/react-native-mpp` the app uses. The package comes from
 * MeaWallet's private registry, so scripts/install-meawallet-mpp.sh vendors it only on
 * machines with access and the app build never sees its own types; where it is vendored,
 * scripts/meawallet-mpp-contract.ts checks this slice against them.
 */
export type MppPackage = {
  default: {
    initialize(): Promise<void>
    ApplePay: ApplePayModule
    GooglePay: GooglePayModule
  }
  MppCardDataParameters: {
    withCardSecret(cardId: string, cardSecret: string): MppCardData
  }
}

/** Null when this build does not carry the SDK: the require throws when the package is
 *  not vendored, and also when it is but its native module was not linked. */
const loadPackage = (): MppPackage | null => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require("@meawallet/react-native-mpp")
  } catch {
    return null
  }
}

const startSdk = async (): Promise<MeaWalletSdk | null> => {
  const mpp = loadPackage()
  if (!mpp) return null
  try {
    await mpp.default.initialize()
  } catch (err) {
    recordAppError(toError(err))
    return null
  }
  return {
    applePay: mpp.default.ApplePay,
    googlePay: mpp.default.GooglePay,
    cardWithSecret: (cardId, cardSecret) =>
      mpp.MppCardDataParameters.withCardSecret(cardId, cardSecret),
  }
}

let started: Promise<MeaWalletSdk | null> | undefined

/**
 * The SDK once it has read its configuration, or null when the build does not carry it
 * or it would not start. It starts on the first card that asks, so the app launch never
 * waits on it, and a failed start is not retried: the configuration it reads ships with
 * the build, so a second try reads the same file.
 */
export const getMeaWalletSdk = (): Promise<MeaWalletSdk | null> => {
  if (!started) started = startSdk()
  return started
}
