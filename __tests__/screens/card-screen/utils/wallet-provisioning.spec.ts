import {
  WalletAddResult,
  type CardProvisioningData,
} from "@app/screens/card-screen/types"
import type { MeaWalletSdk } from "@app/screens/card-screen/utils/meawallet-sdk"
import {
  addCardToWallet,
  canAddCardToWallet,
} from "@app/screens/card-screen/utils/wallet-provisioning"

const mockRecordAppError = jest.fn()
jest.mock("@app/utils/error-reporting", () => ({
  ...jest.requireActual("@app/utils/error-reporting"),
  recordAppError: (error: Error) => mockRecordAppError(error),
}))

let mockIsProvisioningAvailable = true
const mockFetchProvisioningData = jest.fn()
jest.mock("@app/screens/card-screen/utils/card-provisioning-data", () => ({
  get isCardProvisioningAvailable() {
    return mockIsProvisioningAvailable
  },
  fetchCardProvisioningData: (cardId: string) => mockFetchProvisioningData(cardId),
}))

const mockGetMeaWalletSdk = jest.fn()
jest.mock("@app/screens/card-screen/utils/meawallet-sdk", () => ({
  getMeaWalletSdk: () => mockGetMeaWalletSdk(),
}))

const card = { cardId: "card-1", lastFour: "4242" }
const otherCard = { cardId: "card-2", lastFour: "1111" }

const provisioning: CardProvisioningData = {
  cardSecret: "secret-1",
  displayName: "Blink Visa •• 4242",
  address: {
    name: "Satoshi Nakamoto",
    line1: "1 Main St",
    line2: "",
    city: "San Salvador",
    region: "SS",
    postalCode: "1101",
    countryCode: "SV",
    phoneNumber: "+50370000000",
  },
}

/** An SDK whose Apple Pay takes the card, the platform the tests run as. */
const fakeSdk = () => {
  const sdk = {
    applePay: {
      canAddPaymentPass: jest.fn().mockResolvedValue(true),
      canAddPaymentPassWithPrimaryAccountNumberSuffix: jest.fn().mockResolvedValue(true),
      initializeOemTokenization: jest
        .fn()
        .mockResolvedValue({ tokenizationReceipt: "r" }),
      showAddPaymentPassView: jest.fn().mockResolvedValue("ACTIVATED"),
    },
    googlePay: {
      isWalletAvailable: jest.fn(),
      checkWalletForCardSuffix: jest.fn(),
      pushCard: jest.fn(),
    },
    cardWithSecret: jest.fn().mockReturnValue({ type: "SECRET" }),
  }
  return sdk satisfies MeaWalletSdk
}

/** A card provisioning request the test answers by hand, to keep an add running. */
const deferredProvisioning = () => {
  let resolve: (data: CardProvisioningData) => void = () => undefined
  let reject: (error: Error) => void = () => undefined
  const promise = new Promise<CardProvisioningData>((settle, fail) => {
    resolve = settle
    reject = fail
  })
  return { promise, resolve, reject }
}

describe("canAddCardToWallet", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockIsProvisioningAvailable = true
  })

  it("does not offer the card while the backend cannot provision it", async () => {
    mockIsProvisioningAvailable = false

    await expect(canAddCardToWallet(card)).resolves.toBe(false)
    expect(mockGetMeaWalletSdk).not.toHaveBeenCalled()
  })

  it("does not offer the card when the build carries no device wallet SDK", async () => {
    mockGetMeaWalletSdk.mockResolvedValue(null)

    await expect(canAddCardToWallet(card)).resolves.toBe(false)
  })

  it("offers the card when the device wallet can take it", async () => {
    mockGetMeaWalletSdk.mockResolvedValue(fakeSdk())

    await expect(canAddCardToWallet(card)).resolves.toBe(true)
  })

  it("does not offer the card the device wallet cannot take", async () => {
    const sdk = fakeSdk()
    sdk.applePay.canAddPaymentPass.mockResolvedValue(false)
    mockGetMeaWalletSdk.mockResolvedValue(sdk)

    await expect(canAddCardToWallet(card)).resolves.toBe(false)
  })
})

describe("addCardToWallet", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockIsProvisioningAvailable = true
    mockFetchProvisioningData.mockResolvedValue(provisioning)
  })

  it("adds the card with the data the backend provisions for it", async () => {
    const sdk = fakeSdk()
    mockGetMeaWalletSdk.mockResolvedValue(sdk)

    await expect(addCardToWallet(card)).resolves.toBe(WalletAddResult.Added)
    expect(mockFetchProvisioningData).toHaveBeenCalledWith("card-1")
    expect(sdk.cardWithSecret).toHaveBeenCalledWith("card-1", "secret-1")
    expect(mockRecordAppError).not.toHaveBeenCalled()
  })

  it("fails and reports when the build carries no device wallet SDK", async () => {
    mockGetMeaWalletSdk.mockResolvedValue(null)

    await expect(addCardToWallet(card)).rejects.toThrow(
      "This build carries no device wallet SDK",
    )
    expect(mockFetchProvisioningData).not.toHaveBeenCalled()
    expect(mockRecordAppError).toHaveBeenCalledWith(
      new Error("This build carries no device wallet SDK"),
    )
  })

  it("fails and reports when the backend cannot provision the card", async () => {
    mockGetMeaWalletSdk.mockResolvedValue(fakeSdk())
    mockFetchProvisioningData.mockRejectedValue(new Error("provisioning unavailable"))

    await expect(addCardToWallet(card)).rejects.toThrow("provisioning unavailable")
    expect(mockRecordAppError).toHaveBeenCalledTimes(1)
  })

  describe("one wallet add at a time", () => {
    beforeEach(() => {
      mockGetMeaWalletSdk.mockResolvedValue(fakeSdk())
    })

    it("joins the add already running for the same card", async () => {
      const pending = deferredProvisioning()
      mockFetchProvisioningData.mockReturnValueOnce(pending.promise)

      const first = addCardToWallet(card)
      const second = addCardToWallet(card)
      expect(second).toBe(first)

      pending.reject(new Error("provisioning unavailable"))
      await expect(first).rejects.toThrow("provisioning unavailable")
      expect(mockRecordAppError).toHaveBeenCalledTimes(1)
    })

    it("turns an add for another card away as busy while one is running", async () => {
      const pending = deferredProvisioning()
      mockFetchProvisioningData.mockReturnValueOnce(pending.promise)

      const first = addCardToWallet(card)
      await expect(addCardToWallet(otherCard)).resolves.toBe(WalletAddResult.Busy)

      pending.resolve(provisioning)
      await expect(first).resolves.toBe(WalletAddResult.Added)
    })

    it("starts a new add once the previous one settles", async () => {
      const first = addCardToWallet(card)
      await expect(first).resolves.toBe(WalletAddResult.Added)

      const second = addCardToWallet(otherCard)

      expect(second).not.toBe(first)
      await expect(second).resolves.toBe(WalletAddResult.Added)
    })

    it("starts a new add once the previous one fails", async () => {
      mockFetchProvisioningData.mockRejectedValueOnce(
        new Error("provisioning unavailable"),
      )
      const first = addCardToWallet(card)
      await expect(first).rejects.toThrow()

      await expect(addCardToWallet(otherCard)).resolves.toBe(WalletAddResult.Added)
    })
  })
})
