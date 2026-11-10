import {
  getMeaWalletSdk,
  resetMeaWalletSdk,
} from "@app/screens/card-screen/utils/meawallet-sdk"

const mockRecordAppError = jest.fn()
jest.mock("@app/utils/error-reporting", () => ({
  ...jest.requireActual("@app/utils/error-reporting"),
  recordAppError: (error: Error) => mockRecordAppError(error),
}))

const MPP_PACKAGE = "@meawallet/react-native-mpp"

const mockInitialize = jest.fn()
const mockWithCardSecret = jest.fn()
const applePay = { canAddPaymentPass: jest.fn() }
const googlePay = { isWalletAvailable: jest.fn() }

/** How a require of the package fails when the build does not carry it. */
const leaveThePackageOut = () => {
  jest.doMock(
    MPP_PACKAGE,
    () => {
      throw Object.assign(new Error(`Cannot find module '${MPP_PACKAGE}'`), {
        code: "MODULE_NOT_FOUND",
      })
    },
    { virtual: true },
  )
}

/** The package as the vendored SDK exposes it. */
const vendorThePackage = () => {
  jest.doMock(
    MPP_PACKAGE,
    () => ({
      __esModule: true,
      default: {
        initialize: () => mockInitialize(),
        ApplePay: applePay,
        GooglePay: googlePay,
      },
      MppCardDataParameters: {
        withCardSecret: (cardId: string, cardSecret: string) =>
          mockWithCardSecret(cardId, cardSecret),
      },
    }),
    { virtual: true },
  )
}

describe("getMeaWalletSdk", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    resetMeaWalletSdk()
    mockInitialize.mockResolvedValue(undefined)
  })

  it("answers null when the build does not carry the SDK", async () => {
    leaveThePackageOut()

    await expect(getMeaWalletSdk()).resolves.toBeNull()
    expect(mockRecordAppError).not.toHaveBeenCalled()
  })

  /** Vendored but not linked, the package throws as it loads, reading its native module. */
  it("answers null when the SDK's native module is not linked", async () => {
    jest.doMock(
      MPP_PACKAGE,
      () => {
        throw new TypeError("Cannot set property 'initialize' of undefined")
      },
      { virtual: true },
    )

    await expect(getMeaWalletSdk()).resolves.toBeNull()
    expect(mockRecordAppError).not.toHaveBeenCalled()
  })

  it("starts the SDK and hands back its wallets", async () => {
    vendorThePackage()

    const sdk = await getMeaWalletSdk()

    expect(mockInitialize).toHaveBeenCalledTimes(1)
    expect(sdk?.applePay).toBe(applePay)
    expect(sdk?.googlePay).toBe(googlePay)
  })

  it("starts the SDK once, however many cards ask", async () => {
    vendorThePackage()

    const first = getMeaWalletSdk()
    const second = getMeaWalletSdk()

    expect(second).toBe(first)
    await first
    expect(mockInitialize).toHaveBeenCalledTimes(1)
  })

  it("builds card data from the card id and its secret", async () => {
    vendorThePackage()
    const cardData = { type: "SECRET" }
    mockWithCardSecret.mockReturnValue(cardData)

    const sdk = await getMeaWalletSdk()

    expect(sdk?.cardWithSecret("card-1", "secret-1")).toBe(cardData)
    expect(mockWithCardSecret).toHaveBeenCalledWith("card-1", "secret-1")
  })

  /** The configuration it failed to read ships with the build, so trying again reads the
   *  same file: the failure is reported once and stands for the session. */
  it("reports a start that fails and does not try again", async () => {
    vendorThePackage()
    mockInitialize.mockRejectedValue(new Error("mea_config not found"))

    await expect(getMeaWalletSdk()).resolves.toBeNull()
    await expect(getMeaWalletSdk()).resolves.toBeNull()

    expect(mockInitialize).toHaveBeenCalledTimes(1)
    expect(mockRecordAppError).toHaveBeenCalledTimes(1)
    expect(mockRecordAppError).toHaveBeenCalledWith(new Error("mea_config not found"))
  })
})
