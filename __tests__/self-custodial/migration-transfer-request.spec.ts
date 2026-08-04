import { Network } from "@breeztech/breez-sdk-spark-react-native"

import {
  buildMigrationLnAddressProof,
  buildMigrationTransferRequest,
  MigrationSdkStatus,
} from "@app/self-custodial/migration-transfer-request"
import { SelfCustodialErrorCode } from "@app/self-custodial/sdk-error"
import KeyStoreWrapper from "@app/utils/storage/secureStorage"

const mockInitSdk = jest.fn()
const mockDisconnectSdk = jest.fn()
const mockGetWalletInfo = jest.fn()
const mockReceivePayment = jest.fn()
const mockReportError = jest.fn()
const mockClassifySdkError = jest.fn()

jest.mock("@app/self-custodial/bridge", () => ({
  initSdk: (args: unknown) => mockInitSdk(args),
  disconnectSdk: (sdk: unknown) => mockDisconnectSdk(sdk),
  getWalletInfo: (sdk: unknown) => mockGetWalletInfo(sdk),
}))

jest.mock("@app/self-custodial/config", () => ({
  ...jest.requireActual("@app/self-custodial/config"),
  storageDirFor: (accountId: string) => `/tmp/${accountId}`,
}))

jest.mock("@app/utils/error-logging", () => ({
  reportError: (operation: string, err: unknown) => mockReportError(operation, err),
}))

jest.mock("@app/self-custodial/sdk-error", () => ({
  ...jest.requireActual("@app/self-custodial/sdk-error"),
  classifySdkError: (err: unknown) => mockClassifySdkError(err),
}))

jest.mock("@app/utils/storage/secureStorage", () => ({
  __esModule: true,
  default: { getMnemonicForAccount: jest.fn() },
}))

const SPARK_PUBKEY = "03".padEnd(66, "a")
const mockGetMnemonic = KeyStoreWrapper.getMnemonicForAccount as jest.Mock

const buildRequest = (signChallenge = jest.fn(() => "migrate:challenge")) =>
  buildMigrationTransferRequest({
    accountId: "sc-account-1",
    network: Network.Regtest,
    leewaySatPerVbyte: 1,
    signChallenge,
  })

/** Lets queued microtasks drain without advancing to the next run's connect, so the test
 *  can observe a second call still waiting on the first's per-directory lock. */
const flushMicrotasks = (): Promise<void> =>
  new Promise((resolve) => {
    setImmediate(resolve)
  })

/** A connected SDK stub carrying both the message signer and the invoice mint the transfer
 *  request drives directly, so a network mint failure reaches the classifier with its tag. */
const sdkWith = (signMessage: jest.Mock = jest.fn()) => ({
  signMessage,
  receivePayment: mockReceivePayment,
})

describe("buildMigrationTransferRequest", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetMnemonic.mockResolvedValue("abandon abandon ability")
    mockInitSdk.mockResolvedValue(sdkWith())
    mockGetWalletInfo.mockResolvedValue({ identityPubkey: SPARK_PUBKEY })
    mockDisconnectSdk.mockResolvedValue(undefined)
    mockReceivePayment.mockResolvedValue({ paymentRequest: "lnbcrt1invoice" })
    mockClassifySdkError.mockReturnValue(SelfCustodialErrorCode.Generic)
  })

  const withSignMessage = (signMessage: jest.Mock) =>
    mockInitSdk.mockResolvedValue(sdkWith(signMessage))

  it("collects the three destination fields the backend takes", async () => {
    withSignMessage(jest.fn().mockResolvedValue({ signature: "deadbeef" }))

    const result = await buildRequest()

    expect(result).toEqual({
      status: MigrationSdkStatus.Ok,
      value: {
        sparkInvoice: "lnbcrt1invoice",
        sparkPubkey: SPARK_PUBKEY,
        proofSignature: "deadbeef",
      },
    })
  })

  /** The wallet's own key is what the backend checks the proof against, so the challenge
   *  has to name the pubkey this very connection reports. */
  it("signs a challenge built from the connected wallet's pubkey", async () => {
    const signMessage = jest.fn().mockResolvedValue({ signature: "deadbeef" })
    withSignMessage(signMessage)
    const signChallenge = jest.fn(() => "migrate:built-from-pubkey")

    await buildRequest(signChallenge)

    expect(signChallenge).toHaveBeenCalledWith(SPARK_PUBKEY)
    expect(signMessage).toHaveBeenCalledWith({
      message: "migrate:built-from-pubkey",
      compact: true,
    })
  })

  /** A no-amount invoice: the server decides the figure, and one naming an amount would
   *  only be a second opinion it has to refuse. A day of expiry outlives the prompt drain
   *  rather than leaving the lifetime to the SDK's unspecified default. */
  it("asks for a no-amount invoice with an explicit long expiry", async () => {
    withSignMessage(jest.fn().mockResolvedValue({ signature: "deadbeef" }))

    await buildRequest()

    expect(mockReceivePayment).toHaveBeenCalledWith({
      paymentMethod: {
        tag: "Bolt11Invoice",
        inner: {
          description: "",
          amountSats: undefined,
          expirySecs: 24 * 60 * 60,
          paymentHash: undefined,
        },
      },
    })
  })

  it("connects once, against the provisioned account's own storage", async () => {
    withSignMessage(jest.fn().mockResolvedValue({ signature: "deadbeef" }))

    await buildRequest()

    expect(mockInitSdk).toHaveBeenCalledTimes(1)
    expect(mockInitSdk).toHaveBeenCalledWith({
      mnemonic: "abandon abandon ability",
      storageDir: "/tmp/sc-account-1",
      network: Network.Regtest,
      leewaySatPerVbyte: 1,
    })
  })

  it("reports a device with no mnemonic for the provisioned account", async () => {
    mockGetMnemonic.mockResolvedValue(null)

    const result = await buildRequest()

    expect(result).toEqual({ status: MigrationSdkStatus.NoMnemonic })
    expect(mockInitSdk).not.toHaveBeenCalled()
  })

  it("reports a failure when the wallet will not sign", async () => {
    withSignMessage(jest.fn().mockRejectedValue(new Error("signer unavailable")))

    const result = await buildRequest()

    expect(result).toEqual({
      status: MigrationSdkStatus.Failed,
      error: expect.objectContaining({ message: "signer unavailable" }),
    })
  })

  /** The signature follows the invoice, so a mint that throws never spends one; a settled
   *  (non-network) failure hands the user to support. */
  it("hands over on a settled invoice mint failure, without signing", async () => {
    const signMessage = jest.fn().mockResolvedValue({ signature: "deadbeef" })
    withSignMessage(signMessage)
    mockReceivePayment.mockRejectedValue(new Error("receive is down"))

    const result = await buildRequest()

    expect(result).toEqual({
      status: MigrationSdkStatus.Failed,
      error: expect.objectContaining({ message: "receive is down" }),
    })
    expect(signMessage).not.toHaveBeenCalled()
  })

  /** The mint is called on the SDK directly, not through the adapter that flattens an
   *  SdkError to a string, so a network-tagged failure reaches the classifier with its tag
   *  intact and stays a retryable connection error rather than a settled handover. */
  it("keeps a network-tagged invoice mint failure retryable", async () => {
    const signMessage = jest.fn().mockResolvedValue({ signature: "deadbeef" })
    withSignMessage(signMessage)
    const mintError = new Error("invoice mint: connection reset")
    mockClassifySdkError.mockReturnValue(SelfCustodialErrorCode.NetworkError)
    mockReceivePayment.mockRejectedValue(mintError)

    const result = await buildRequest()

    expect(mockClassifySdkError).toHaveBeenCalledWith(mintError)
    expect(result).toEqual({
      status: MigrationSdkStatus.ConnectionError,
      error: mintError,
    })
    expect(signMessage).not.toHaveBeenCalled()
  })

  it("reports a failure when the mint returns no invoice, without signing", async () => {
    const signMessage = jest.fn().mockResolvedValue({ signature: "deadbeef" })
    withSignMessage(signMessage)
    mockReceivePayment.mockResolvedValue({})

    const result = await buildRequest()

    expect(result).toEqual({
      status: MigrationSdkStatus.Failed,
      error: expect.objectContaining({ message: "No invoice returned" }),
    })
    expect(signMessage).not.toHaveBeenCalled()
  })

  it("wraps a thrown non-error so the caller always gets an Error", async () => {
    mockInitSdk.mockRejectedValue("connection refused")

    const result = await buildRequest()

    expect(result).toEqual({
      status: MigrationSdkStatus.Failed,
      error: expect.objectContaining({ message: "connection refused" }),
    })
  })

  /** Two SDKs on one storage directory race each other, so the connection is always
   *  released, including on the failure paths. */
  it("disconnects even when the transfer request fails", async () => {
    withSignMessage(jest.fn().mockRejectedValue(new Error("signer unavailable")))

    await buildRequest()

    expect(mockDisconnectSdk).toHaveBeenCalledTimes(1)
  })

  it("never disconnects a connection it did not open", async () => {
    mockInitSdk.mockRejectedValue(new Error("connect failed"))

    await buildRequest()

    expect(mockDisconnectSdk).not.toHaveBeenCalled()
  })

  /** A disconnect that fails must not turn a collected request into a failure. */
  it("keeps the request when only the disconnect fails", async () => {
    withSignMessage(jest.fn().mockResolvedValue({ signature: "deadbeef" }))
    mockDisconnectSdk.mockRejectedValue(new Error("already gone"))

    const result = await buildRequest()

    expect(result.status).toBe(MigrationSdkStatus.Ok)
    expect(mockReportError).toHaveBeenCalledWith(
      "Migration transfer SDK disconnect",
      expect.any(Error),
    )
  })

  /** A network-tagged SDK failure (a connection dropped during connect) can be sent again,
   *  so it is a retryable connection error rather than a settled failure that hands over. */
  it("classifies a network-tagged connect failure as a connection error", async () => {
    mockClassifySdkError.mockReturnValue(SelfCustodialErrorCode.NetworkError)
    mockInitSdk.mockRejectedValue(new Error("connection reset"))

    const result = await buildRequest()

    expect(result).toEqual({
      status: MigrationSdkStatus.ConnectionError,
      error: expect.objectContaining({ message: "connection reset" }),
    })
  })

  /** Two SDKs on one storage directory race, so a second run for the same account waits for
   *  the first to release before it connects, covering a retry fired mid-connect. */
  it("serializes overlapping runs on the same storage directory", async () => {
    withSignMessage(jest.fn().mockResolvedValue({ signature: "deadbeef" }))
    let releaseFirstConnect: () => void = () => {}
    const connectedSdk = sdkWith(jest.fn().mockResolvedValue({ signature: "deadbeef" }))
    mockInitSdk.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          releaseFirstConnect = () => resolve(connectedSdk)
        }),
    )

    const first = buildRequest()
    const second = buildRequest()
    await flushMicrotasks()
    expect(mockInitSdk).toHaveBeenCalledTimes(1)

    releaseFirstConnect()
    await Promise.all([first, second])

    expect(mockInitSdk).toHaveBeenCalledTimes(2)
  })
})

describe("buildMigrationLnAddressProof", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetMnemonic.mockResolvedValue("abandon abandon ability")
    mockInitSdk.mockResolvedValue({
      signMessage: jest.fn().mockResolvedValue({ signature: "deadbeef" }),
    })
    mockGetWalletInfo.mockResolvedValue({ identityPubkey: SPARK_PUBKEY })
    mockDisconnectSdk.mockResolvedValue(undefined)
    mockClassifySdkError.mockReturnValue(SelfCustodialErrorCode.Generic)
  })

  /** The re-point moves no funds, so it needs the proof of possession and nothing else:
   *  the same signed challenge as the commit, but no invoice. */
  it("collects only the proof fields, without asking for an invoice", async () => {
    const result = await buildMigrationLnAddressProof({
      accountId: "sc-account-1",
      network: Network.Regtest,
      leewaySatPerVbyte: 1,
      signChallenge: () => "migrate:challenge",
    })

    expect(result).toEqual({
      status: MigrationSdkStatus.Ok,
      value: { sparkPubkey: SPARK_PUBKEY, proofSignature: "deadbeef" },
    })
    expect(mockReceivePayment).not.toHaveBeenCalled()
  })
})
