import { LnUrlPayServiceResponse } from "lnurl-pay"

import { WalletCurrency } from "@app/graphql/generated"
import {
  createAmountLightningPaymentDetails,
  createIntraledgerPaymentDetails,
  createLnurlPaymentDetails,
  createNoAmountLightningPaymentDetails,
  createNoAmountOnchainPaymentDetails,
} from "@app/screens/send-bitcoin-screen/payment-details"
import { IdempotencyKeyRef } from "@app/screens/send-bitcoin-screen/payment-details/index.types"
import { MoneyAmount, WalletOrDisplayCurrency } from "@app/types/amounts"

/**
 * The idempotency key identifies a money movement: destination, settlement amount and
 * source wallet. These lock the rule deciding which rebuilds of a payment detail keep the
 * key — so a user who backs out of the confirmation screen and re-enters retries under the
 * original key and the backend can refuse the duplicate — and which mint a fresh one, so a
 * genuinely different payment is never deduped against the previous one.
 *
 * The setters are probed structurally: the factories are generic over the wallet currency
 * and their return type is a discriminated union, which is more than these assertions need.
 */
type Probe = {
  idempotencyKeyRef?: IdempotencyKeyRef
  setConvertMoneyAmount: (c: unknown) => Probe
  setSendingWalletDescriptor: (w: unknown) => Probe
  setMemo?: (memo: string) => Probe
  setAmount?: (amount: unknown) => Probe
  setInvoice?: (args: unknown) => Probe
  setSuccessAction?: (action: unknown) => Probe
}

const asProbe = (detail: unknown): Probe => detail as Probe

const btcWallet = { id: "btc-wallet-id", currency: WalletCurrency.Btc } as const
const otherBtcWallet = {
  id: "other-btc-wallet-id",
  currency: WalletCurrency.Btc,
} as const

const convertMoneyAmount = <W extends WalletOrDisplayCurrency>(
  moneyAmount: MoneyAmount<WalletOrDisplayCurrency>,
  toCurrency: W,
): MoneyAmount<W> =>
  ({ amount: moneyAmount.amount, currency: toCurrency }) as MoneyAmount<W>

const btcAmount = {
  amount: 1000,
  currency: WalletCurrency.Btc,
} as MoneyAmount<WalletOrDisplayCurrency>

const otherAmount = {
  amount: 2000,
  currency: WalletCurrency.Btc,
} as MoneyAmount<WalletOrDisplayCurrency>

const PAYMENT_REQUEST = "lnbc10u1p3tsl26pp5r5zbnn7zsq7rmzmzs6xzr3z0m0cztlxpqzk0e3rf5x"

const btcSettlementAmount = {
  amount: 1000,
  currency: WalletCurrency.Btc,
  currencyCode: "BTC",
} as const

/** Stands in for the send: the hook writes the minted key onto the ref it was handed. */
const minted = (detail: Probe): Probe => {
  if (detail.idempotencyKeyRef) {
    detail.idempotencyKeyRef.current = "minted-key"
  }
  return detail
}

const keyOf = (detail: Probe): string | undefined => detail.idempotencyKeyRef?.current

describe("idempotency key ref — intraledger", () => {
  const base = () =>
    asProbe(
      createIntraledgerPaymentDetails({
        handle: "alice",
        recipientWalletId: "recipient-wallet-id",
        sendingWalletDescriptor: btcWallet,
        convertMoneyAmount,
        unitOfAccountAmount: btcAmount,
      }),
    )

  it("gives every fresh intent its own ref", () => {
    expect(base().idempotencyKeyRef).toBeDefined()
    expect(base().idempotencyKeyRef).not.toBe(base().idempotencyKeyRef)
  })

  it("keeps the key across a display-currency rebuild", () => {
    // Fires from an effect on the details screen, potentially while a send is in flight.
    expect(keyOf(minted(base()).setConvertMoneyAmount(convertMoneyAmount))).toBe(
      "minted-key",
    )
  })

  it("keeps the key across a memo edit", () => {
    expect(keyOf(minted(base()).setMemo?.("a note") as Probe)).toBe("minted-key")
  })

  it("drops the key when the amount changes", () => {
    expect(keyOf(minted(base()).setAmount?.(otherAmount) as Probe)).toBeUndefined()
  })

  it("drops the key when the sending wallet changes", () => {
    expect(
      keyOf(minted(base()).setSendingWalletDescriptor(otherBtcWallet)),
    ).toBeUndefined()
  })
})

describe("idempotency key ref — no-amount lightning", () => {
  const base = () =>
    asProbe(
      createNoAmountLightningPaymentDetails({
        paymentRequest: PAYMENT_REQUEST,
        sendingWalletDescriptor: btcWallet,
        convertMoneyAmount,
        unitOfAccountAmount: btcAmount,
      }),
    )

  it("keeps the key across memo and display-currency rebuilds", () => {
    expect(keyOf(minted(base()).setConvertMoneyAmount(convertMoneyAmount))).toBe(
      "minted-key",
    )
    expect(keyOf(minted(base()).setMemo?.("note") as Probe)).toBe("minted-key")
  })

  it("drops the key on a new amount or wallet", () => {
    expect(keyOf(minted(base()).setAmount?.(otherAmount) as Probe)).toBeUndefined()
    expect(
      keyOf(minted(base()).setSendingWalletDescriptor(otherBtcWallet)),
    ).toBeUndefined()
  })
})

describe("idempotency key ref — amount lightning", () => {
  const base = () =>
    asProbe(
      createAmountLightningPaymentDetails({
        paymentRequest: PAYMENT_REQUEST,
        paymentRequestAmount: btcSettlementAmount,
        sendingWalletDescriptor: btcWallet,
        convertMoneyAmount,
      }),
    )

  it("keeps the key across a memo edit and drops it on a wallet switch", () => {
    expect(keyOf(minted(base()).setMemo?.("note") as Probe)).toBe("minted-key")
    expect(
      keyOf(minted(base()).setSendingWalletDescriptor(otherBtcWallet)),
    ).toBeUndefined()
  })
})

describe("idempotency key ref — lnurl", () => {
  const base = () =>
    asProbe(
      createLnurlPaymentDetails({
        lnurl: "lnurl1dp68gurn8ghj7",
        lnurlParams: {
          callback: "https://example.com/callback",
          fixed: false,
          min: 1,
          max: 100000,
          domain: "example.com",
          metadata: [],
          identifier: "alice@example.com",
        } as unknown as LnUrlPayServiceResponse,
        isMerchant: false,
        sendingWalletDescriptor: btcWallet,
        convertMoneyAmount,
        unitOfAccountAmount: btcAmount,
      }),
    )

  it("keeps the key across a re-fetched invoice", () => {
    // Every press of "Next" fetches a fresh bolt11 for the same lnurl and amount. Without
    // this, one intent would carry two keys and the merchant could be paid twice.
    const withInvoice = minted(base()).setInvoice?.({
      paymentRequest: PAYMENT_REQUEST,
      paymentRequestAmount: btcSettlementAmount,
    }) as Probe

    expect(keyOf(withInvoice)).toBe("minted-key")
  })

  it("keeps the key across a success action and a memo", () => {
    expect(keyOf(minted(base()).setSuccessAction?.(undefined) as Probe)).toBe(
      "minted-key",
    )
    expect(keyOf(minted(base()).setMemo?.("note") as Probe)).toBe("minted-key")
  })

  it("drops the key on a new amount", () => {
    expect(keyOf(minted(base()).setAmount?.(otherAmount) as Probe)).toBeUndefined()
  })
})

describe("idempotency key ref — onchain", () => {
  const base = () =>
    asProbe(
      createNoAmountOnchainPaymentDetails({
        address: "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4",
        sendingWalletDescriptor: btcWallet,
        convertMoneyAmount,
        unitOfAccountAmount: btcAmount,
      }),
    )

  it("keeps the key across memo and display-currency rebuilds", () => {
    expect(keyOf(minted(base()).setConvertMoneyAmount(convertMoneyAmount))).toBe(
      "minted-key",
    )
    expect(keyOf(minted(base()).setMemo?.("note") as Probe)).toBe("minted-key")
  })

  it("drops the key on a new amount or wallet", () => {
    expect(keyOf(minted(base()).setAmount?.(otherAmount) as Probe)).toBeUndefined()
    expect(
      keyOf(minted(base()).setSendingWalletDescriptor(otherBtcWallet)),
    ).toBeUndefined()
  })
})
