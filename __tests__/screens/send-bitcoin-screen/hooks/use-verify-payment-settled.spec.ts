import { TxDirection, TxStatus } from "@app/graphql/generated"
import {
  getPaymentHashFromInvoice,
  pollForSettledStatus,
  resolveSettledOutcome,
} from "@app/screens/send-bitcoin-screen/hooks/use-verify-payment-settled"

/** The mainnet invoice used across the app's mocks (app/graphql/mocks.ts). */
const MAINNET_INVOICE =
  "lnbc1p3lwh3npp5z5wkmy86gcww9u2h8tuekqmfz4pwlpkk4rfst8cm7jwzm8fklldsdqqcqzpuxqyz5" +
  "vqsp52fv968tprd3dqkuqsq78nw8s0xr9zn7rx686ukq2rfnsdf27pwtq9qyyssqhc7m7d3gfvdsywx9" +
  "56d3u3h45xyf7xurc6yv5qxysspjnhhxstl3wet525ldxn3x6xd0g58nk6wuvwle0fhn5sul396za3qs" +
  "5ma7zxsqjvklym"
const MAINNET_INVOICE_HASH =
  "151d6d90fa461ce2f1573af99b03691542ef86d6a8d3059f1bf49c2d9d36ffdb"

const sendTx = (status: TxStatus, createdAt = 1700000000) => ({
  status,
  direction: TxDirection.Send,
  createdAt,
})
const receiveTx = (status: TxStatus) => ({ status, direction: TxDirection.Receive })

describe("getPaymentHashFromInvoice", () => {
  it("decodes the payment hash from a bolt11 invoice", () => {
    expect(getPaymentHashFromInvoice(MAINNET_INVOICE, "mainnet")).toBe(
      MAINNET_INVOICE_HASH,
    )
  })

  it("returns undefined for an undecodable destination instead of throwing", () => {
    expect(getPaymentHashFromInvoice("LNURL1notaninvoice", "mainnet")).toBeUndefined()
    expect(getPaymentHashFromInvoice("", "mainnet")).toBeUndefined()
  })
})

describe("resolveSettledOutcome", () => {
  it("resolves an outgoing SUCCESS transaction", () => {
    expect(resolveSettledOutcome([sendTx(TxStatus.Success)])).toEqual({
      status: "SUCCESS",
      createdAt: 1700000000,
    })
  })

  it("resolves an outgoing PENDING transaction", () => {
    expect(resolveSettledOutcome([sendTx(TxStatus.Pending)])?.status).toBe("PENDING")
  })

  it("prefers SUCCESS over PENDING", () => {
    expect(
      resolveSettledOutcome([sendTx(TxStatus.Pending), sendTx(TxStatus.Success)])?.status,
    ).toBe("SUCCESS")
  })

  it("does not treat a FAILURE as settled", () => {
    expect(resolveSettledOutcome([sendTx(TxStatus.Failure)])).toBeUndefined()
  })

  it("ignores incoming transactions", () => {
    expect(resolveSettledOutcome([receiveTx(TxStatus.Success)])).toBeUndefined()
  })

  it("is undefined for empty or missing transactions", () => {
    expect(resolveSettledOutcome([])).toBeUndefined()
    expect(resolveSettledOutcome(undefined)).toBeUndefined()
    expect(resolveSettledOutcome(null)).toBeUndefined()
  })
})

describe("pollForSettledStatus", () => {
  const options = { attempts: 3, delayMs: 0 }

  it("resolves once a later attempt finds a settled transaction", async () => {
    const fetchTransactions = jest
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce([sendTx(TxStatus.Success)])
    await expect(pollForSettledStatus(fetchTransactions, options)).resolves.toEqual({
      status: "SUCCESS",
      createdAt: 1700000000,
    })
    expect(fetchTransactions).toHaveBeenCalledTimes(3)
  })

  it("stops polling as soon as an outcome is found", async () => {
    const fetchTransactions = jest.fn().mockResolvedValue([sendTx(TxStatus.Pending)])
    await pollForSettledStatus(fetchTransactions, options)
    expect(fetchTransactions).toHaveBeenCalledTimes(1)
  })

  it("gives up after the configured attempts", async () => {
    const fetchTransactions = jest.fn().mockResolvedValue([])
    await expect(
      pollForSettledStatus(fetchTransactions, options),
    ).resolves.toBeUndefined()
    expect(fetchTransactions).toHaveBeenCalledTimes(3)
  })

  it("treats a fetch error as not-found and keeps polling", async () => {
    const fetchTransactions = jest
      .fn()
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce([sendTx(TxStatus.Success)])
    await expect(pollForSettledStatus(fetchTransactions, options)).resolves.toEqual({
      status: "SUCCESS",
      createdAt: 1700000000,
    })
  })
})
