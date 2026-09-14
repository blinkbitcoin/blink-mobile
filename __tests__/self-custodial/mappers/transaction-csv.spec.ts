import {
  PaymentMethod,
  PaymentStatus,
  PaymentType,
  type Payment,
} from "@breeztech/breez-sdk-spark-react-native"

import {
  CsvTypeVocabulary,
  buildTransactionsCsv,
} from "@app/self-custodial/mappers/transaction-csv"

jest.mock("@app/self-custodial/config", () => ({
  requireSparkTokenIdentifier: () => "test-token-id",
}))

const IDENTITY_PUBKEY = "pubkey123"

const EXPECTED_HEADER =
  "id,walletId,type,credit,debit,fee,currency,timestamp,pendingConfirmation," +
  "journalId,lnMemo,usd,feeUsd,recipientWalletId,username,memoFromPayer," +
  "paymentHash,pubkey,feeKnownInAdvance,address,txHash,displayAmount,displayFee,displayCurrency"

/** 2025-01-01T00:00:00Z as unix seconds — the builder must render it like the backend
 *  does: plain JS Date#toString, not ISO. */
const TIMESTAMP_SECONDS = 1735689600n
const EXPECTED_TIMESTAMP = String(new Date(1735689600 * 1000))

/** Expected rows are built from a 24-entry column map so the assertions stay readable
 *  and cannot drift a comma out of place. */
const expectedRow = (columns: Partial<Record<string, string>>): string => {
  const header = EXPECTED_HEADER.split(",")
  const unknown = Object.keys(columns).filter((name) => !header.includes(name))
  if (unknown.length > 0) throw new Error(`unknown columns: ${unknown.join(", ")}`)
  return header.map((name) => columns[name] ?? "").join(",")
}

const basePayment = {
  status: PaymentStatus.Completed,
  timestamp: TIMESTAMP_SECONDS,
  conversionDetails: undefined,
}

const lightningDetails = (overrides: Record<string, unknown> = {}) => ({
  tag: "Lightning",
  inner: {
    description: "coffee",
    destinationPubkey: "02destpub",
    htlcDetails: { paymentHash: "lnhash01" },
    lnurlPayInfo: undefined,
    ...overrides,
  },
})

const lightningReceive: Payment = {
  ...basePayment,
  id: "ln-recv-1",
  paymentType: PaymentType.Receive,
  method: PaymentMethod.Lightning,
  amount: 100000n,
  fees: 0n,
  details: lightningDetails(),
} as never

const lightningSend: Payment = {
  ...basePayment,
  id: "ln-send-1",
  paymentType: PaymentType.Send,
  method: PaymentMethod.Lightning,
  amount: 50000n,
  fees: 10n,
  details: lightningDetails({ description: "rent" }),
} as never

const onchainDeposit: Payment = {
  ...basePayment,
  id: "dep-1",
  paymentType: PaymentType.Receive,
  method: PaymentMethod.Deposit,
  amount: 200000n,
  fees: 0n,
  details: { tag: "Deposit", inner: { txId: "deposittx01" } },
} as never

const onchainWithdraw: Payment = {
  ...basePayment,
  id: "wd-1",
  paymentType: PaymentType.Send,
  method: PaymentMethod.Withdraw,
  amount: 300000n,
  fees: 250n,
  details: { tag: "Withdraw", inner: { txId: "withdrawtx01" } },
} as never

const sparkTransferReceive: Payment = {
  ...basePayment,
  id: "spark-1",
  paymentType: PaymentType.Receive,
  method: PaymentMethod.Spark,
  amount: 42000n,
  fees: 0n,
  details: {
    tag: "Spark",
    inner: {
      invoiceDetails: { description: "spark note" },
      htlcDetails: { paymentHash: "sparkhash01" },
      conversionInfo: undefined,
    },
  },
} as never

const usdbMetadata = { identifier: "test-token-id", ticker: "USDB", decimals: 6 }

/** 1_510_000 base units at 6 decimals = $1.51 = 151 cents; fee 20_000 = 2 cents. */
const tokenSend: Payment = {
  ...basePayment,
  id: "usdb-send-1",
  paymentType: PaymentType.Send,
  method: PaymentMethod.Token,
  amount: 1510000n,
  fees: 20000n,
  details: {
    tag: "Token",
    inner: {
      metadata: usdbMetadata,
      txHash: "tokentx01",
      txType: "Transfer",
      invoiceDetails: { description: "usdb note" },
      conversionInfo: undefined,
    },
  },
} as never

const conversionBtcLeg: Payment = {
  ...basePayment,
  id: "conv-btc-1",
  paymentType: PaymentType.Send,
  method: PaymentMethod.Spark,
  amount: 10000n,
  fees: 21n,
  details: {
    tag: "Spark",
    inner: {
      invoiceDetails: undefined,
      htlcDetails: undefined,
      conversionInfo: { conversionId: "conv1" },
    },
  },
} as never

const conversionUsdLeg: Payment = {
  ...basePayment,
  id: "conv-usd-1",
  paymentType: PaymentType.Receive,
  method: PaymentMethod.Token,
  amount: 990000n,
  fees: 0n,
  details: {
    tag: "Token",
    inner: {
      metadata: usdbMetadata,
      txHash: "convtokentx01",
      txType: "Transfer",
      invoiceDetails: undefined,
      conversionInfo: { conversionId: "conv1" },
    },
  },
} as never

const rows = (csv: string): string[] => csv.split("\n")

describe("buildTransactionsCsv", () => {
  it("returns an empty string for an empty payment list", () => {
    expect(buildTransactionsCsv([], { identityPubkey: IDENTITY_PUBKEY })).toBe("")
  })

  it("starts with the exact custodial header and ends with a trailing newline", () => {
    const csv = buildTransactionsCsv([lightningReceive], {
      identityPubkey: IDENTITY_PUBKEY,
    })

    expect(rows(csv)[0]).toBe(EXPECTED_HEADER)
    expect(csv.endsWith("\n")).toBe(true)
  })

  it("maps a lightning receive to an invoice credit row", () => {
    const csv = buildTransactionsCsv([lightningReceive], {
      identityPubkey: IDENTITY_PUBKEY,
    })

    expect(rows(csv)[1]).toBe(
      expectedRow({
        id: "ln-recv-1",
        walletId: "pubkey123-btc",
        type: "invoice",
        credit: "100000",
        debit: "0",
        fee: "0",
        currency: "BTC",
        timestamp: EXPECTED_TIMESTAMP,
        pendingConfirmation: "false",
        lnMemo: "coffee",
        paymentHash: "lnhash01",
        pubkey: "02destpub",
      }),
    )
  })

  it("maps a lightning send to a payment debit row whose debit includes the fee", () => {
    const csv = buildTransactionsCsv([lightningSend], {
      identityPubkey: IDENTITY_PUBKEY,
    })

    expect(rows(csv)[1]).toBe(
      expectedRow({
        id: "ln-send-1",
        walletId: "pubkey123-btc",
        type: "payment",
        credit: "0",
        debit: "50010",
        fee: "10",
        currency: "BTC",
        timestamp: EXPECTED_TIMESTAMP,
        pendingConfirmation: "false",
        lnMemo: "rent",
        paymentHash: "lnhash01",
        pubkey: "02destpub",
      }),
    )
  })

  it("maps an on-chain deposit to onchain_receipt with the txid", () => {
    const csv = buildTransactionsCsv([onchainDeposit], {
      identityPubkey: IDENTITY_PUBKEY,
    })

    expect(rows(csv)[1]).toBe(
      expectedRow({
        id: "dep-1",
        walletId: "pubkey123-btc",
        type: "onchain_receipt",
        credit: "200000",
        debit: "0",
        fee: "0",
        currency: "BTC",
        timestamp: EXPECTED_TIMESTAMP,
        pendingConfirmation: "false",
        txHash: "deposittx01",
      }),
    )
  })

  it("maps an on-chain withdrawal to onchain_payment with the txid", () => {
    const csv = buildTransactionsCsv([onchainWithdraw], {
      identityPubkey: IDENTITY_PUBKEY,
    })

    expect(rows(csv)[1]).toBe(
      expectedRow({
        id: "wd-1",
        walletId: "pubkey123-btc",
        type: "onchain_payment",
        credit: "0",
        debit: "300250",
        fee: "250",
        currency: "BTC",
        timestamp: EXPECTED_TIMESTAMP,
        pendingConfirmation: "false",
        txHash: "withdrawtx01",
      }),
    )
  })

  it("maps a spark transfer with its memo and payment hash", () => {
    const csv = buildTransactionsCsv([sparkTransferReceive], {
      identityPubkey: IDENTITY_PUBKEY,
    })

    expect(rows(csv)[1]).toBe(
      expectedRow({
        id: "spark-1",
        walletId: "pubkey123-btc",
        type: "spark_transfer",
        credit: "42000",
        debit: "0",
        fee: "0",
        currency: "BTC",
        timestamp: EXPECTED_TIMESTAMP,
        pendingConfirmation: "false",
        lnMemo: "spark note",
        paymentHash: "sparkhash01",
      }),
    )
  })

  it("maps a USDB token send to a cents row with exact usd and feeUsd values", () => {
    const csv = buildTransactionsCsv([tokenSend], { identityPubkey: IDENTITY_PUBKEY })

    expect(rows(csv)[1]).toBe(
      expectedRow({
        id: "usdb-send-1",
        walletId: "pubkey123-usd",
        type: "spark_transfer",
        credit: "0",
        debit: "153",
        fee: "0",
        currency: "USD",
        timestamp: EXPECTED_TIMESTAMP,
        pendingConfirmation: "false",
        lnMemo: "usdb note",
        usd: "1.51",
        feeUsd: "0.02",
        txHash: "tokentx01",
      }),
    )
  })

  it("labels both conversion legs as conversion in the descriptive vocabulary", () => {
    const csv = buildTransactionsCsv([conversionBtcLeg, conversionUsdLeg], {
      identityPubkey: IDENTITY_PUBKEY,
    })

    expect(rows(csv)[1]).toBe(
      expectedRow({
        id: "conv-btc-1",
        walletId: "pubkey123-btc",
        type: "conversion",
        credit: "0",
        debit: "10021",
        fee: "21",
        currency: "BTC",
        timestamp: EXPECTED_TIMESTAMP,
        pendingConfirmation: "false",
      }),
    )
    expect(rows(csv)[2]).toBe(
      expectedRow({
        id: "conv-usd-1",
        walletId: "pubkey123-usd",
        type: "conversion",
        credit: "99",
        debit: "0",
        fee: "0",
        currency: "USD",
        timestamp: EXPECTED_TIMESTAMP,
        pendingConfirmation: "false",
        usd: "0.99",
        feeUsd: "0",
        txHash: "convtokentx01",
      }),
    )
  })

  it("labels a payment with top-level conversionDetails as a conversion", () => {
    const autoConvertSend = {
      ...lightningSend,
      id: "auto-conv-1",
      conversionDetails: { status: "Completed", conversions: [] },
    } as never as Payment

    const csv = buildTransactionsCsv([autoConvertSend], {
      identityPubkey: IDENTITY_PUBKEY,
    })

    expect(rows(csv)[1].split(",")[2]).toBe("conversion")
  })

  it("uses the custodial-compat vocabulary when asked", () => {
    const csv = buildTransactionsCsv(
      [lightningReceive, sparkTransferReceive, conversionBtcLeg],
      { identityPubkey: IDENTITY_PUBKEY, vocabulary: CsvTypeVocabulary.CustodialCompat },
    )

    expect(rows(csv)[1].split(",")[2]).toBe("invoice")
    expect(rows(csv)[2].split(",")[2]).toBe("on_us")
    expect(rows(csv)[3].split(",")[2]).toBe("self_trade")
  })

  it("marks pending payments with pendingConfirmation=true", () => {
    const pending = {
      ...lightningReceive,
      id: "pend-1",
      status: PaymentStatus.Pending,
    } as never as Payment

    const csv = buildTransactionsCsv([pending], { identityPubkey: IDENTITY_PUBKEY })

    expect(rows(csv)[1].split(",")[8]).toBe("true")
  })

  it("quotes and escapes memos containing commas, quotes and newlines", () => {
    const trickyMemo = {
      ...lightningReceive,
      id: "memo-1",
      details: lightningDetails({ description: 'a, "quoted"\nmemo' }),
    } as never as Payment

    const csv = buildTransactionsCsv([trickyMemo], { identityPubkey: IDENTITY_PUBKEY })

    expect(csv).toContain('"a, ""quoted""\nmemo"')
  })

  it("keeps amounts above Number.MAX_SAFE_INTEGER exact", () => {
    const whale = {
      ...lightningReceive,
      id: "whale-1",
      amount: 9007199254740993n,
    } as never as Payment

    const csv = buildTransactionsCsv([whale], { identityPubkey: IDENTITY_PUBKEY })

    expect(rows(csv)[1].split(",")[3]).toBe("9007199254740993")
  })

  it("types detail-less payments from the payment method", () => {
    const bareWith = (method: number, paymentType: number, id: string) =>
      ({
        ...basePayment,
        id,
        paymentType,
        method,
        amount: 1000n,
        fees: 0n,
        details: undefined,
      }) as never as Payment

    const barePayments = [
      bareWith(PaymentMethod.Deposit, PaymentType.Receive, "bare-dep"),
      bareWith(PaymentMethod.Withdraw, PaymentType.Send, "bare-wd"),
      bareWith(PaymentMethod.Spark, PaymentType.Send, "bare-spark"),
      bareWith(PaymentMethod.Token, PaymentType.Send, "bare-token"),
      bareWith(PaymentMethod.Unknown, PaymentType.Send, "bare-send"),
    ]

    const csv = buildTransactionsCsv(barePayments, { identityPubkey: IDENTITY_PUBKEY })

    expect(rows(csv)[1].split(",")[2]).toBe("onchain_receipt")
    expect(rows(csv)[2].split(",")[2]).toBe("onchain_payment")
    expect(rows(csv)[3].split(",")[2]).toBe("spark_transfer")
    expect(rows(csv)[4].split(",")[2]).toBe("spark_transfer")
    expect(rows(csv)[5].split(",")[2]).toBe("payment")

    const compat = buildTransactionsCsv(barePayments, {
      identityPubkey: IDENTITY_PUBKEY,
      vocabulary: CsvTypeVocabulary.CustodialCompat,
    })

    expect(rows(compat)[3].split(",")[2]).toBe("on_us")
  })

  it("falls back to lightning typing by direction when details are missing", () => {
    const bare = {
      ...basePayment,
      id: "bare-1",
      paymentType: PaymentType.Receive,
      method: PaymentMethod.Unknown,
      amount: 1000n,
      fees: 0n,
      details: undefined,
    } as never as Payment

    const csv = buildTransactionsCsv([bare], { identityPubkey: IDENTITY_PUBKEY })

    expect(rows(csv)[1]).toBe(
      expectedRow({
        id: "bare-1",
        walletId: "pubkey123-btc",
        type: "invoice",
        credit: "1000",
        debit: "0",
        fee: "0",
        currency: "BTC",
        timestamp: EXPECTED_TIMESTAMP,
        pendingConfirmation: "false",
      }),
    )
  })
})
