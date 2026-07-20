import { Network } from "@breeztech/breez-sdk-spark-react-native"

import {
  buildMigrationTransferRequest,
  MigrationTransferRequestStatus,
} from "@app/self-custodial/migration-transfer-request"
import KeyStoreWrapper from "@app/utils/storage/secureStorage"

const mockInitSdk = jest.fn()
const mockDisconnectSdk = jest.fn()
const mockGetWalletInfo = jest.fn()
const mockReceiveLightning = jest.fn()
const mockReportError = jest.fn()

jest.mock("@app/self-custodial/bridge", () => ({
  initSdk: (args: unknown) => mockInitSdk(args),
  disconnectSdk: (sdk: unknown) => mockDisconnectSdk(sdk),
  getWalletInfo: (sdk: unknown) => mockGetWalletInfo(sdk),
  createReceiveLightning: () => mockReceiveLightning,
}))

jest.mock("@app/self-custodial/config", () => ({
  ...jest.requireActual("@app/self-custodial/config"),
  storageDirFor: (accountId: string) => `/tmp/${accountId}`,
}))

jest.mock("@app/utils/error-logging", () => ({
  reportError: (operation: string, err: unknown) => mockReportError(operation, err),
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

describe("buildMigrationTransferRequest", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetMnemonic.mockResolvedValue("abandon abandon ability")
    mockInitSdk.mockResolvedValue({ signMessage: jest.fn() })
    mockGetWalletInfo.mockResolvedValue({ identityPubkey: SPARK_PUBKEY })
    mockDisconnectSdk.mockResolvedValue(undefined)
    mockReceiveLightning.mockResolvedValue({ invoice: "lnbcrt1invoice" })
  })

  const withSignMessage = (signMessage: jest.Mock) =>
    mockInitSdk.mockResolvedValue({ signMessage })

  it("collects the three destination fields the backend takes", async () => {
    withSignMessage(jest.fn().mockResolvedValue({ signature: "deadbeef" }))

    const result = await buildRequest()

    expect(result).toEqual({
      status: MigrationTransferRequestStatus.Ok,
      request: {
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

    expect(mockReceiveLightning).toHaveBeenCalledWith({
      memo: undefined,
      expirySecs: 24 * 60 * 60,
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

    expect(result).toEqual({ status: MigrationTransferRequestStatus.NoMnemonic })
    expect(mockInitSdk).not.toHaveBeenCalled()
  })

  it("reports a failure when the wallet will not sign", async () => {
    withSignMessage(jest.fn().mockRejectedValue(new Error("signer unavailable")))

    const result = await buildRequest()

    expect(result).toEqual({
      status: MigrationTransferRequestStatus.Failed,
      error: expect.objectContaining({ message: "signer unavailable" }),
    })
  })

  it("reports a failure when no invoice comes back", async () => {
    withSignMessage(jest.fn().mockResolvedValue({ signature: "deadbeef" }))
    mockReceiveLightning.mockResolvedValue({ errors: [{ message: "receive is down" }] })

    const result = await buildRequest()

    expect(result).toEqual({
      status: MigrationTransferRequestStatus.Failed,
      error: expect.objectContaining({ message: "receive is down" }),
    })
  })

  it("survives an invoice failure that carries no message", async () => {
    withSignMessage(jest.fn().mockResolvedValue({ signature: "deadbeef" }))
    mockReceiveLightning.mockResolvedValue({})

    const result = await buildRequest()

    expect(result).toEqual({
      status: MigrationTransferRequestStatus.Failed,
      error: expect.objectContaining({ message: "No invoice returned" }),
    })
  })

  it("wraps a thrown non-error so the caller always gets an Error", async () => {
    mockInitSdk.mockRejectedValue("connection refused")

    const result = await buildRequest()

    expect(result).toEqual({
      status: MigrationTransferRequestStatus.Failed,
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

    expect(result.status).toBe(MigrationTransferRequestStatus.Ok)
    expect(mockReportError).toHaveBeenCalledWith(
      "Migration transfer SDK disconnect",
      expect.any(Error),
    )
  })
})
