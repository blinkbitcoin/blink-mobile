import {
  GeneratePaymentRequestAdapters,
  Invoice,
  PaymentRequestState,
} from "@app/screens/receive-bitcoin-screen/payment/index.types"
import { createPaymentRequest } from "@app/screens/receive-bitcoin-screen/payment/payment-request"
import { createPaymentRequestCreationData } from "@app/screens/receive-bitcoin-screen/payment/payment-request-creation-data"
import { toUsdMoneyAmount } from "@app/types/amounts"
import { WalletCurrency } from "@app/graphql/generated"

import { btcWalletDescriptor, defaultParams, usdWalletDescriptor } from "./helpers"

const usdAmountInvoice =
  "lnbc49100n1p3l2q6cpp5y8lc3dv7qnplxhc3z9j0sap4n0hu99g39tl3srx6zj0hrqy2snwsdqqcqzpuxqzfvsp5q6t5f3xeruu4k5sk5nlmxx2kzlw2pydmmjk9g4qqmsc9c6ffzldq9qyyssq9lesnumasvvlvwc7yckvuepklttlvwhjqw3539qqqttsyh5s5j246spy9gezng7ng3d40qsrn6dhsrgs7rccaftzulx5auqqd5lz0psqfskeg4"
const noAmountInvoice =
  "lnbc1p3l2qmfpp5t2ne20k97f3n24el9a792fte4q6n7jqr6x8qjjnklgktrdvpqq2sdqqcqzpuxqyz5vqsp5n23d3as4jxvpaemnsnvyynlpsg6pzsmxhn3tcwxealcyh6566nys9qyyssqce802uft9d44llekxqedzufkeaq7anldzpf64s4hmskwd9h5ppe4xrgq4dpq8rc3ph048066wgexjtgw4fs8032xwuazw9kdjcq8ujgpdk07ht"
const btcAmountInvoice =
  "lnbc23690n1p3l2qugpp5jeflfqjpxhe0hg3tzttc325j5l6czs9vq9zqx5edpt0yf7k6cypsdqqcqzpuxqyz5vqsp5lteanmnwddszwut839etrgjenfr3dv5tnvz2d2ww2mvggq7zn46q9qyyssqzcz0rvt7r30q7jul79xqqwpr4k2e8mgd23fkjm422sdgpndwql93d4wh3lap9yfwahue9n7ju80ynkqly0lrqqd2978dr8srkrlrjvcq2v5s6k"
const mockOnChainAddress = "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx"

const mockReceiveLightning = jest.fn(async ({ amount }) => {
  if (amount?.currency === WalletCurrency.Usd) {
    return { invoice: { paymentRequest: usdAmountInvoice } }
  }
  if (amount && amount.amount > 0) {
    return { invoice: { paymentRequest: btcAmountInvoice } }
  }
  return { invoice: { paymentRequest: noAmountInvoice } }
})

const mockReceiveOnchain = jest.fn(async () => ({ address: mockOnChainAddress }))

export const adapters: GeneratePaymentRequestAdapters = {
  receiveLightning: mockReceiveLightning,
  receiveOnchain: mockReceiveOnchain,
}

export const clearMocks = () => {
  mockReceiveLightning.mockClear()
  mockReceiveOnchain.mockClear()
}

describe("payment request", () => {
  it("ln with btc receiving wallet", async () => {
    const prcd = createPaymentRequestCreationData({
      ...defaultParams,
      receivingWalletDescriptor: btcWalletDescriptor,
    })

    const pr = createPaymentRequest({ creationData: prcd, adapters })

    expect(pr.info).toBeUndefined()
    expect(pr.state).toBe(PaymentRequestState.Idle)

    const prNew = await pr.generateRequest()
    expect(prNew.info).not.toBeUndefined()
    expect(mockReceiveLightning).toHaveBeenCalledWith(
      expect.objectContaining({ walletCurrency: WalletCurrency.Btc }),
    )
    expect(prNew.state).toBe(PaymentRequestState.Created)
    expect(prNew.info?.data?.invoiceType).toBe(Invoice.Lightning)
    expect(prNew.info?.data?.getFullUriFn({})).toBe(noAmountInvoice)
  })

  it("ln with usd receiving wallet", async () => {
    const prcd = createPaymentRequestCreationData({
      ...defaultParams,
      receivingWalletDescriptor: usdWalletDescriptor,
    })

    const pr = createPaymentRequest({ creationData: prcd, adapters })

    expect(pr.info).toBeUndefined()
    expect(pr.state).toBe(PaymentRequestState.Idle)

    const prNew = await pr.generateRequest()
    expect(prNew.info).not.toBeUndefined()
    expect(mockReceiveLightning).toHaveBeenCalledWith(
      expect.objectContaining({ walletCurrency: WalletCurrency.Usd }),
    )
    expect(prNew.state).toBe(PaymentRequestState.Created)
    expect(prNew.info?.data?.invoiceType).toBe(Invoice.Lightning)
    expect(prNew.info?.data?.getFullUriFn({})).toBe(noAmountInvoice)
  })

  it("ln with btc receiving wallet - set amount", async () => {
    const prcd = createPaymentRequestCreationData({
      ...defaultParams,
      receivingWalletDescriptor: btcWalletDescriptor,
      unitOfAccountAmount: toUsdMoneyAmount(1),
    })

    const pr = createPaymentRequest({ creationData: prcd, adapters })

    expect(pr.info).toBeUndefined()
    expect(pr.state).toBe(PaymentRequestState.Idle)

    const prNew = await pr.generateRequest()
    expect(prNew.info).not.toBeUndefined()
    expect(mockReceiveLightning).toHaveBeenCalledWith(
      expect.objectContaining({ walletCurrency: WalletCurrency.Btc }),
    )
    expect(prNew.state).toBe(PaymentRequestState.Created)
    expect(prNew.info?.data?.invoiceType).toBe(Invoice.Lightning)
    expect(prNew.info?.data?.getFullUriFn({})).toBe(btcAmountInvoice)
  })

  it("ln with usd receiving wallet - set amount", async () => {
    const prcd = createPaymentRequestCreationData({
      ...defaultParams,
      receivingWalletDescriptor: usdWalletDescriptor,
      unitOfAccountAmount: toUsdMoneyAmount(1),
    })

    const pr = createPaymentRequest({ creationData: prcd, adapters })

    expect(pr.info).toBeUndefined()
    expect(pr.state).toBe(PaymentRequestState.Idle)

    const prNew = await pr.generateRequest()
    expect(prNew.info).not.toBeUndefined()
    expect(mockReceiveLightning).toHaveBeenCalledWith(
      expect.objectContaining({ walletCurrency: WalletCurrency.Usd }),
    )
    expect(prNew.state).toBe(PaymentRequestState.Created)
    expect(prNew.info?.data?.invoiceType).toBe(Invoice.Lightning)
    expect(prNew.info?.data?.getFullUriFn({})).toBe(usdAmountInvoice)
  })

  it("paycode/lnurl", async () => {
    const prcd = createPaymentRequestCreationData({
      ...defaultParams,
      type: Invoice.PayCode,
      username: "username",
      posUrl: "posUrl",
    })

    const pr = createPaymentRequest({ creationData: prcd, adapters })
    expect(pr.info).toBeUndefined()
    expect(pr.state).toBe(PaymentRequestState.Idle)

    const prNew = await pr.generateRequest()
    expect(prNew.info).not.toBeUndefined()
    expect(prNew.state).toBe(PaymentRequestState.Created)
    expect(prNew.info?.data?.invoiceType).toBe(Invoice.PayCode)
    expect(prNew.info?.data?.getFullUriFn({})).toBe(
      "LNURL1WPHHX4TJDSHJUAM9D3KZ66MWDAMKUTMVDE6HYMRS9A6HXETJDESK6EG3S7SZA",
    )
  })

  it("onchain", async () => {
    const prcd = createPaymentRequestCreationData({
      ...defaultParams,
      type: Invoice.OnChain,
    })

    const pr = createPaymentRequest({ creationData: prcd, adapters })

    expect(pr.info).toBeUndefined()
    expect(pr.state).toBe(PaymentRequestState.Idle)

    const prNew = await pr.generateRequest()
    expect(prNew.info).not.toBeUndefined()
    expect(mockReceiveOnchain).toHaveBeenCalled()
    expect(prNew.state).toBe(PaymentRequestState.Created)
    expect(prNew.info?.data?.invoiceType).toBe(Invoice.OnChain)
    expect(
      prNew.info?.data?.getFullUriFn({}).startsWith(`bitcoin:${mockOnChainAddress}`),
    ).toBe(true)
  })
})
