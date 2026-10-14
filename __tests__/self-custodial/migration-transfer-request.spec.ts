import {
  Network,
  PaymentDetails_Tags as PaymentDetailsTags,
  PaymentStatus,
  PaymentType,
} from "@breeztech/breez-sdk-spark-react-native"

import {
  buildMigrationLnAddressProof,
  buildMigrationTransferRequest,
  checkMigrationReceiveLanded,
  MigrationSdkStatus,
} from "@app/self-custodial/migration-transfer-request"
import { SelfCustodialErrorCode } from "@app/self-custodial/sdk-error"
import KeyStoreWrapper from "@app/utils/storage/secureStorage"

const mockInitSdk = jest.fn()
const mockDisconnectSdk = jest.fn()
const mockGetWalletInfo = jest.fn()
const mockListPayments = jest.fn()

/** Obviously synthetic: the check only compares it for equality. */
const MIGRATION_INVOICE = "lnbcrt-migration-invoice"
const mockReceivePayment = jest.fn()
const mockReportError = jest.fn()
const mockClassifySdkError = jest.fn()

jest.mock("@app/self-custodial/bridge", () => ({
  initSdk: (args: unknown) => mockInitSdk(args),
  disconnectSdk: (sdk: unknown) => mockDisconnectSdk(sdk),
  getWalletInfo: (sdk: unknown) => mockGetWalletInfo(sdk),
  listPayments: (sdk: unknown, offset: number, limit: number) =>
    mockListPayments(sdk, offset, limit),
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

describe("checkMigrationReceiveLanded", () => {
  const mockGetInfo = jest.fn()

  const check = (sparkInvoice: string | null = MIGRATION_INVOICE) =>
    checkMigrationReceiveLanded({
      accountId: "sc-account-1",
      network: Network.Regtest,
      leewaySatPerVbyte: 1,
      sparkInvoice,
    })

  beforeEach(() => {
    jest.clearAllMocks()
    mockGetMnemonic.mockResolvedValue("abandon abandon ability")
    mockInitSdk.mockResolvedValue({ getInfo: mockGetInfo })
    mockDisconnectSdk.mockResolvedValue(undefined)
    mockGetInfo.mockResolvedValue({ balanceSats: 0 })
    mockListPayments.mockResolvedValue({ payments: [] })
    mockClassifySdkError.mockReturnValue(SelfCustodialErrorCode.Generic)
  })

  const settledReceiveOf = (invoice: string) => ({
    paymentType: PaymentType.Receive,
    status: PaymentStatus.Completed,
    details: { tag: PaymentDetailsTags.Lightning, inner: { invoice } },
  })

  /** The forced sync is the point of the call: it is what claims a payment Spark held
   *  for the offline wallet, so the read is detector and actuator in one. */
  it("confirms the receive once the drain invoice is settled", async () => {
    mockGetInfo.mockResolvedValue({ balanceSats: BigInt(21000) })
    mockListPayments.mockResolvedValue({
      payments: [settledReceiveOf(MIGRATION_INVOICE)],
    })

    const result = await check()

    expect(mockGetInfo).toHaveBeenCalledWith({ ensureSynced: true })
    expect(result).toEqual({
      status: MigrationSdkStatus.Ok,
      value: { hasReceived: true, balanceSats: 21000 },
    })
  })

  /** The whole point of matching the invoice: a wallet the user brought in, or one that
   *  took an unrelated payment mid-flow, has a balance that says nothing about the drain. */
  it("does not mistake a funded wallet for a settled drain", async () => {
    mockGetInfo.mockResolvedValue({ balanceSats: BigInt(500000) })
    mockListPayments.mockResolvedValue({
      payments: [settledReceiveOf("lnbcrt-someone-elses-invoice")],
    })

    const result = await check()

    expect(result).toEqual({
      status: MigrationSdkStatus.Ok,
      value: { hasReceived: false, balanceSats: 500000 },
    })
  })

  it("does not accept a pending payment of the drain invoice", async () => {
    mockGetInfo.mockResolvedValue({ balanceSats: BigInt(0) })
    mockListPayments.mockResolvedValue({
      payments: [
        { ...settledReceiveOf(MIGRATION_INVOICE), status: PaymentStatus.Pending },
      ],
    })

    expect(await check()).toEqual({
      status: MigrationSdkStatus.Ok,
      value: { hasReceived: false, balanceSats: 0 },
    })
  })

  /** A send carrying the same invoice is this wallet paying, not being paid. */
  it("does not accept a send that quotes the drain invoice", async () => {
    mockListPayments.mockResolvedValue({
      payments: [
        { ...settledReceiveOf(MIGRATION_INVOICE), paymentType: PaymentType.Send },
      ],
    })

    expect(await check()).toEqual({
      status: MigrationSdkStatus.Ok,
      value: { hasReceived: false, balanceSats: 0 },
    })
  })

  it("ignores a settled receive that is not a lightning payment", async () => {
    mockListPayments.mockResolvedValue({
      payments: [
        {
          paymentType: PaymentType.Receive,
          status: PaymentStatus.Completed,
          details: { tag: PaymentDetailsTags.Deposit, inner: {} },
        },
      ],
    })

    expect(await check()).toEqual({
      status: MigrationSdkStatus.Ok,
      value: { hasReceived: false, balanceSats: 0 },
    })
  })

  it("ignores a settled receive carrying no details at all", async () => {
    mockListPayments.mockResolvedValue({
      payments: [{ paymentType: PaymentType.Receive, status: PaymentStatus.Completed }],
    })

    expect(await check()).toEqual({
      status: MigrationSdkStatus.Ok,
      value: { hasReceived: false, balanceSats: 0 },
    })
  })

  /** Without the invoice there is nothing that proves the drain landed. Answering by
   *  balance here is what would let a funded wallet confirm instantly, so the unprovable
   *  case stays unproven — a funded balance must not change that. */
  it("cannot confirm without an invoice, however funded the wallet is", async () => {
    mockGetInfo.mockResolvedValue({ balanceSats: BigInt(21000) })

    const result = await check(null)

    expect(result).toEqual({
      status: MigrationSdkStatus.Ok,
      value: { hasReceived: false, balanceSats: 21000 },
    })
    expect(mockListPayments).not.toHaveBeenCalled()
  })

  it("reports a still-empty wallet as not received", async () => {
    mockGetInfo.mockResolvedValue({ balanceSats: BigInt(0) })

    const result = await check(null)

    expect(result).toEqual({
      status: MigrationSdkStatus.Ok,
      value: { hasReceived: false, balanceSats: 0 },
    })
  })

  it("reports a device with no mnemonic for the provisioned account", async () => {
    mockGetMnemonic.mockResolvedValue(null)

    const result = await check()

    expect(result).toEqual({ status: MigrationSdkStatus.NoMnemonic })
    expect(mockInitSdk).not.toHaveBeenCalled()
  })

  it("keeps a network-tagged connect failure retryable", async () => {
    mockClassifySdkError.mockReturnValue(SelfCustodialErrorCode.NetworkError)
    mockInitSdk.mockRejectedValue(new Error("connection reset"))

    const result = await check()

    expect(result).toEqual({
      status: MigrationSdkStatus.ConnectionError,
      error: expect.objectContaining({ message: "connection reset" }),
    })
  })

  it("disconnects even when the balance read fails", async () => {
    mockGetInfo.mockRejectedValue(new Error("info unavailable"))

    const result = await check()

    expect(result).toEqual({
      status: MigrationSdkStatus.Failed,
      error: expect.objectContaining({ message: "info unavailable" }),
    })
    expect(mockDisconnectSdk).toHaveBeenCalledTimes(1)
  })

  /** The check and the invoice builder open SDKs on the same storage directory, so a
   *  check fired while a commit retry is mid-connect must wait its turn. */
  it("serializes behind a transfer request on the same storage directory", async () => {
    let releaseFirstConnect: () => void = () => {}
    const connectedSdk = sdkWith(jest.fn().mockResolvedValue({ signature: "deadbeef" }))
    mockGetWalletInfo.mockResolvedValue({ identityPubkey: SPARK_PUBKEY })
    mockReceivePayment.mockResolvedValue({ paymentRequest: "lnbcrt1invoice" })
    mockInitSdk.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          releaseFirstConnect = () => resolve(connectedSdk)
        }),
    )
    mockInitSdk.mockResolvedValue({ getInfo: mockGetInfo })

    const request = buildMigrationTransferRequest({
      accountId: "sc-account-1",
      network: Network.Regtest,
      leewaySatPerVbyte: 1,
      signChallenge: () => "migrate:challenge",
    })
    const landed = check()
    await flushMicrotasks()
    expect(mockInitSdk).toHaveBeenCalledTimes(1)
    expect(mockGetInfo).not.toHaveBeenCalled()

    releaseFirstConnect()
    await Promise.all([request, landed])

    expect(mockInitSdk).toHaveBeenCalledTimes(2)
    expect(mockGetInfo).toHaveBeenCalledTimes(1)
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
