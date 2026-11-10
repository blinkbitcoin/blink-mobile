import { it } from "@jest/globals"
import { Platform } from "react-native"

import {
  WalletAddResult,
  type CardProvisioningData,
} from "@app/screens/card-screen/types"
import { deviceWalletFor } from "@app/screens/card-screen/utils/device-wallets"
import type { MeaWalletSdk } from "@app/screens/card-screen/utils/meawallet-sdk"

const card = { cardId: "card-1", lastFour: "4242" }
const cardData = { type: "SECRET" }
const tokenization = { tokenizationReceipt: "receipt-1" }

const provisioning: CardProvisioningData = {
  cardSecret: "secret-1",
  displayName: "Blink Visa •• 4242",
  address: {
    name: "Satoshi Nakamoto",
    line1: "1 Main St",
    line2: "Apt 2",
    city: "San Salvador",
    region: "SS",
    postalCode: "1101",
    countryCode: "SV",
    phoneNumber: "+50370000000",
  },
}

const fakeSdk = () => {
  const sdk = {
    applePay: {
      canAddPaymentPass: jest.fn().mockResolvedValue(true),
      canAddPaymentPassWithPrimaryAccountNumberSuffix: jest.fn().mockResolvedValue(true),
      initializeOemTokenization: jest.fn().mockResolvedValue(tokenization),
      showAddPaymentPassView: jest.fn().mockResolvedValue("ACTIVATED"),
    },
    googlePay: {
      isWalletAvailable: jest.fn().mockResolvedValue(true),
      checkWalletForCardSuffix: jest.fn().mockResolvedValue([]),
      push: jest.fn().mockResolvedValue({ tokenId: "token-1" }),
    },
    cardWithSecret: jest.fn().mockReturnValue(cardData),
  }
  return sdk satisfies MeaWalletSdk
}

/** A rejection as React Native hands the SDK's NSError to JS: its code as `code`, its
 *  domain as `domain`, and the SDK's description of it as the message. */
const appleError = (
  domain: string,
  code: string,
  message = `Error Domain=${domain} Code=${code} "(null)"`,
) => Object.assign(new Error(message), { code, domain })

/** A rejection as the SDK forwards it from Google Pay: its error name as `code`, and the
 *  native error, wallet code included, as `userInfo`. */
const googleError = (code: string, message: string) =>
  Object.assign(new Error(message), {
    code,
    userInfo: { name: code, walletApiErrorCode: 0 },
  })

const originalOs = Platform.OS
const runOn = (os: typeof Platform.OS) => {
  Object.defineProperty(Platform, "OS", { get: () => os, configurable: true })
}

afterEach(() => {
  runOn(originalOs)
})

describe("deviceWalletFor on iOS", () => {
  beforeEach(() => {
    runOn("ios")
  })

  it("asks Apple Pay and never Google Pay", async () => {
    const sdk = fakeSdk()

    await deviceWalletFor(sdk).canAdd(card)

    expect(sdk.applePay.canAddPaymentPass).toHaveBeenCalled()
    expect(sdk.googlePay.isWalletAvailable).not.toHaveBeenCalled()
  })

  it("does not offer the card where the device cannot add payment passes", async () => {
    const sdk = fakeSdk()
    sdk.applePay.canAddPaymentPass.mockResolvedValue(false)

    await expect(deviceWalletFor(sdk).canAdd(card)).resolves.toBe(false)
    expect(
      sdk.applePay.canAddPaymentPassWithPrimaryAccountNumberSuffix,
    ).not.toHaveBeenCalled()
  })

  it("offers the card when Apple Pay can take that card", async () => {
    const sdk = fakeSdk()

    await expect(deviceWalletFor(sdk).canAdd(card)).resolves.toBe(true)
    expect(
      sdk.applePay.canAddPaymentPassWithPrimaryAccountNumberSuffix,
    ).toHaveBeenCalledWith("4242")
  })

  it("does not offer a card Apple Pay already holds", async () => {
    const sdk = fakeSdk()
    sdk.applePay.canAddPaymentPassWithPrimaryAccountNumberSuffix.mockResolvedValue(false)

    await expect(deviceWalletFor(sdk).canAdd(card)).resolves.toBe(false)
  })

  it("adds the card through Apple's sheet with the card secret", async () => {
    const sdk = fakeSdk()

    await expect(deviceWalletFor(sdk).add(card, provisioning)).resolves.toBe(
      WalletAddResult.Added,
    )
    expect(sdk.cardWithSecret).toHaveBeenCalledWith("card-1", "secret-1")
    expect(sdk.applePay.initializeOemTokenization).toHaveBeenCalledWith(cardData)
    expect(sdk.applePay.showAddPaymentPassView).toHaveBeenCalledWith(tokenization)
  })

  /** A pass that still has to activate is in Apple Pay all the same. */
  it("counts a pass that still has to activate as added", async () => {
    const sdk = fakeSdk()
    sdk.applePay.showAddPaymentPassView.mockResolvedValue("REQUIRES_ACTIVATION")

    await expect(deviceWalletFor(sdk).add(card, provisioning)).resolves.toBe(
      WalletAddResult.Added,
    )
  })

  it("answers cancelled when the user dismisses Apple's sheet", async () => {
    const sdk = fakeSdk()
    sdk.applePay.showAddPaymentPassView.mockRejectedValue(
      appleError("PKAddPaymentPassErrorDomain", "1"),
    )

    await expect(deviceWalletFor(sdk).add(card, provisioning)).resolves.toBe(
      WalletAddResult.Cancelled,
    )
  })

  it("answers cancelled when the system dismisses Apple's sheet", async () => {
    const sdk = fakeSdk()
    sdk.applePay.showAddPaymentPassView.mockRejectedValue(
      appleError("PKAddPaymentPassErrorDomain", "2"),
    )

    await expect(deviceWalletFor(sdk).add(card, provisioning)).resolves.toBe(
      WalletAddResult.Cancelled,
    )
  })

  /** The SDK words the message, and a rewording must not turn every cancel into an error. */
  it("answers cancelled from the domain whatever the message says", async () => {
    const sdk = fakeSdk()
    sdk.applePay.showAddPaymentPassView.mockRejectedValue(
      appleError(
        "PKAddPaymentPassErrorDomain",
        "1",
        "The operation couldn't be completed.",
      ),
    )

    await expect(deviceWalletFor(sdk).add(card, provisioning)).resolves.toBe(
      WalletAddResult.Cancelled,
    )
  })

  it("fails on another domain's error whose message names Apple's", async () => {
    const sdk = fakeSdk()
    const wrapped = appleError(
      "com.meawallet.mpp",
      "1",
      "Error Domain=PKAddPaymentPassErrorDomain Code=1 wrapped by the SDK",
    )
    sdk.applePay.showAddPaymentPassView.mockRejectedValue(wrapped)

    await expect(deviceWalletFor(sdk).add(card, provisioning)).rejects.toBe(wrapped)
  })

  it("fails on Apple's unsupported error rather than calling it a cancel", async () => {
    const sdk = fakeSdk()
    const unsupported = appleError("PKAddPaymentPassErrorDomain", "0")
    sdk.applePay.showAddPaymentPassView.mockRejectedValue(unsupported)

    await expect(deviceWalletFor(sdk).add(card, provisioning)).rejects.toBe(unsupported)
  })

  /** The SDK has codes of its own, and code 1 there is not a cancel. */
  it("fails on an SDK error that shares a cancel code", async () => {
    const sdk = fakeSdk()
    const sdkError = appleError("com.meawallet.mpp", "1")
    sdk.applePay.showAddPaymentPassView.mockRejectedValue(sdkError)

    await expect(deviceWalletFor(sdk).add(card, provisioning)).rejects.toBe(sdkError)
  })

  it("fails on an error that carries no code", async () => {
    const sdk = fakeSdk()
    const noCode = new Error("Error Domain=PKAddPaymentPassErrorDomain Code=1")
    sdk.applePay.showAddPaymentPassView.mockRejectedValue(noCode)

    await expect(deviceWalletFor(sdk).add(card, provisioning)).rejects.toBe(noCode)
  })

  it("fails on a rejection that is not an error", async () => {
    const sdk = fakeSdk()
    sdk.applePay.showAddPaymentPassView.mockRejectedValue("dismissed")

    await expect(deviceWalletFor(sdk).add(card, provisioning)).rejects.toBe("dismissed")
  })

  it("never shows the sheet when the card cannot be prepared for Apple Pay", async () => {
    const sdk = fakeSdk()
    const refused = new Error("card secret refused")
    sdk.applePay.initializeOemTokenization.mockRejectedValue(refused)

    await expect(deviceWalletFor(sdk).add(card, provisioning)).rejects.toBe(refused)
    expect(sdk.applePay.showAddPaymentPassView).not.toHaveBeenCalled()
  })
})

describe("deviceWalletFor on Android", () => {
  beforeEach(() => {
    runOn("android")
  })

  it("asks Google Pay and never Apple Pay", async () => {
    const sdk = fakeSdk()

    await deviceWalletFor(sdk).canAdd(card)

    expect(sdk.googlePay.isWalletAvailable).toHaveBeenCalled()
    expect(sdk.applePay.canAddPaymentPass).not.toHaveBeenCalled()
  })

  it("does not offer the card where Google Wallet is not available", async () => {
    const sdk = fakeSdk()
    sdk.googlePay.isWalletAvailable.mockResolvedValue(false)

    await expect(deviceWalletFor(sdk).canAdd(card)).resolves.toBe(false)
    expect(sdk.googlePay.checkWalletForCardSuffix).not.toHaveBeenCalled()
  })

  it("offers the card when Google Wallet holds no token for it", async () => {
    const sdk = fakeSdk()

    await expect(deviceWalletFor(sdk).canAdd(card)).resolves.toBe(true)
    expect(sdk.googlePay.checkWalletForCardSuffix).toHaveBeenCalledWith("4242")
  })

  it.each(["TOKEN_STATE_ACTIVE", "TOKEN_STATE_SUSPENDED", "TOKEN_STATE_PENDING"])(
    "does not offer a card Google Wallet holds in %s",
    async (tokenState) => {
      const sdk = fakeSdk()
      sdk.googlePay.checkWalletForCardSuffix.mockResolvedValue([{ tokenState }])

      await expect(deviceWalletFor(sdk).canAdd(card)).resolves.toBe(false)
    },
  )

  /** A user who left Google's identity check before finishing must be able to try again. */
  it.each([
    "TOKEN_STATE_NEEDS_IDENTITY_VERIFICATION",
    "TOKEN_STATE_UNTOKENIZED",
    "TOKEN_STATE_NOT_FOUND",
  ])("offers the card again while its only token is in %s", async (tokenState) => {
    const sdk = fakeSdk()
    sdk.googlePay.checkWalletForCardSuffix.mockResolvedValue([{ tokenState }])

    await expect(deviceWalletFor(sdk).canAdd(card)).resolves.toBe(true)
  })

  it("does not offer the card when any of its tokens holds it", async () => {
    const sdk = fakeSdk()
    sdk.googlePay.checkWalletForCardSuffix.mockResolvedValue([
      { tokenState: "TOKEN_STATE_NEEDS_IDENTITY_VERIFICATION" },
      { tokenState: "TOKEN_STATE_ACTIVE" },
    ])

    await expect(deviceWalletFor(sdk).canAdd(card)).resolves.toBe(false)
  })

  it("pushes the card to Google Pay with its secret, name and address", async () => {
    const sdk = fakeSdk()

    await expect(deviceWalletFor(sdk).add(card, provisioning)).resolves.toBe(
      WalletAddResult.Added,
    )
    expect(sdk.cardWithSecret).toHaveBeenCalledWith("card-1", "secret-1")
    expect(sdk.googlePay.push).toHaveBeenCalledWith(cardData, "Blink Visa •• 4242", {
      name: "Satoshi Nakamoto",
      address1: "1 Main St",
      address2: "Apt 2",
      locality: "San Salvador",
      administrativeArea: "SS",
      postalCode: "1101",
      countryCode: "SV",
      phoneNumber: "+50370000000",
    })
  })

  it("answers cancelled when the user backs out of Google's sheet", async () => {
    const sdk = fakeSdk()
    sdk.googlePay.push.mockRejectedValue(
      googleError("OPERATION_CANCELLED_BY_USER", "Operation cancelled by user."),
    )

    await expect(deviceWalletFor(sdk).add(card, provisioning)).resolves.toBe(
      WalletAddResult.Cancelled,
    )
  })

  it("fails when Google Pay refuses the card", async () => {
    const sdk = fakeSdk()
    const refused = googleError("GOOGLE_PAY_ERROR", "Failed to push token")
    sdk.googlePay.push.mockRejectedValue(refused)

    await expect(deviceWalletFor(sdk).add(card, provisioning)).rejects.toBe(refused)
  })

  /** The wrapper's own cancel code, from an intent the system dropped, is not the user
   *  backing out. */
  it("fails on another cancel code the SDK can send", async () => {
    const sdk = fakeSdk()
    const dropped = googleError("PENDING_INTENT_CANCELLED", "PendingIntent was cancelled")
    sdk.googlePay.push.mockRejectedValue(dropped)

    await expect(deviceWalletFor(sdk).add(card, provisioning)).rejects.toBe(dropped)
  })

  it("fails on an error that carries no code", async () => {
    const sdk = fakeSdk()
    const noCode = new Error("Operation cancelled by user.")
    sdk.googlePay.push.mockRejectedValue(noCode)

    await expect(deviceWalletFor(sdk).add(card, provisioning)).rejects.toBe(noCode)
  })

  it("fails on a rejection that is not an error", async () => {
    const sdk = fakeSdk()
    sdk.googlePay.push.mockRejectedValue("OPERATION_CANCELLED_BY_USER")

    await expect(deviceWalletFor(sdk).add(card, provisioning)).rejects.toBe(
      "OPERATION_CANCELLED_BY_USER",
    )
  })
})
