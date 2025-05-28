import {
  GeneratePaymentRequestMutations,
  Invoice,
  PaymentRequestState,
} from "@app/screens/receive-bitcoin-screen/payment/index.types"
import { createPaymentRequest } from "@app/screens/receive-bitcoin-screen/payment/payment-request"
import { createPaymentRequestCreationData } from "@app/screens/receive-bitcoin-screen/payment/payment-request-creation-data"
import { toUsdMoneyAmount } from "@app/types/amounts"

import { btcWalletDescriptor, defaultParams, usdWalletDescriptor } from "./helpers"

const usdAmountInvoice =
  "lnbc49100n1p3l2q6cpp5y8lc3dv7qnplxhc3z9j0sap4n0hu99g39tl3srx6zj0hrqy2snwsdqqcqzpuxqzfvsp5q6t5f3xeruu4k5sk5nlmxx2kzlw2pydmmjk9g4qqmsc9c6ffzldq9qyyssq9lesnumasvvlvwc7yckvuepklttlvwhjqw3539qqqttsyh5s5j246spy9gezng7ng3d40qsrn6dhsrgs7rccaftzulx5auqqd5lz0psqfskeg4"
const noAmountInvoice =
  "lnbc1p3l2qmfpp5t2ne20k97f3n24el9a792fte4q6n7jqr6x8qjjnklgktrdvpqq2sdqqcqzpuxqyz5vqsp5n23d3as4jxvpaemnsnvyynlpsg6pzsmxhn3tcwxealcyh6566nys9qyyssqce802uft9d44llekxqedzufkeaq7anldzpf64s4hmskwd9h5ppe4xrgq4dpq8rc3ph048066wgexjtgw4fs8032xwuazw9kdjcq8ujgpdk07ht"
const btcAmountInvoice =
  "lnbc23690n1p3l2qugpp5jeflfqjpxhe0hg3tzttc325j5l6czs9vq9zqx5edpt0yf7k6cypsdqqcqzpuxqyz5vqsp5lteanmnwddszwut839etrgjenfr3dv5tnvz2d2ww2mvggq7zn46q9qyyssqzcz0rvt7r30q7jul79xqqwpr4k2e8mgd23fkjm422sdgpndwql93d4wh3lap9yfwahue9n7ju80ynkqly0lrqqd2978dr8srkrlrjvcq2v5s6k"
const mockOnChainAddress = "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx"

// Manually created mock objects
const mockLnInvoice = {
  __typename: "LnInvoice",
  paymentRequest: btcAmountInvoice,
  // Add other necessary properties here
}

const mockLnUsdInvoice = {
  __typename: "LnInvoice",
  paymentRequest: usdAmountInvoice,
  // Add other necessary properties here
}

const mockLnNoAmountInvoice = {
  __typename: "LnInvoice",
  paymentRequest: noAmountInvoice,
  // Add other necessary properties here
}

const mockLnInvoiceCreate = jest.fn(() =>
  Promise.resolve({
    data: {
      __typename: "Mutation", // Correct placement according to your schema
      lnInvoiceCreate: {
        __typename: "LnInvoicePayload",
        invoice: mockLnInvoice,
        errors: [],
      },
    },
    errors: [],
  }),
)

const mockLnUsdInvoiceCreate = jest.fn(() =>
  Promise.resolve({
    data: {
      __typename: "Mutation", // Correct placement according to your schema
      lnUsdInvoiceCreate: {
        __typename: "LnInvoicePayload",
        invoice: mockLnUsdInvoice,
        errors: [],
      },
    },
    errors: [],
  }),
)

const mockLnNoAmountInvoiceCreate = jest.fn(() =>
  Promise.resolve({
    data: {
      __typename: "Mutation", // Correct placement according to your schema
      lnNoAmountInvoiceCreate: {
        __typename: "LnNoAmountInvoicePayload",
        invoice: mockLnNoAmountInvoice,
        errors: [],
      },
    },
    errors: [],
  }),
)

const mockOnChainAddressCurrent = jest.fn(() =>
  Promise.resolve({
    data: {
      __typename: "Mutation", // Correct placement according to your schema
      onChainAddressCurrent: {
        __typename: "OnChainAddressPayload",
        address: mockOnChainAddress,
        errors: [],
      },
    },
    errors: [],
  }),
)

export const mutations: GeneratePaymentRequestMutations = {
  // eslint-disable-next-line
  // @ts-ignore type mismatch, but we don't care because it's a mock
  lnInvoiceCreate: mockLnInvoiceCreate,
  // eslint-disable-next-line
  // @ts-ignore type mismatch, but we don't care because it's a mock
  lnUsdInvoiceCreate: mockLnUsdInvoiceCreate,
  // eslint-disable-next-line
  // @ts-ignore type mismatch, but we don't care because it's a mock
  lnNoAmountInvoiceCreate: mockLnNoAmountInvoiceCreate,
  // eslint-disable-next-line
  // @ts-ignore type mismatch, but we don't care because it's a mock
  onChainAddressCurrent: mockOnChainAddressCurrent,
}

export const clearMocks = () => {
  mockLnInvoiceCreate.mockClear()
  mockLnUsdInvoiceCreate.mockClear()
  mockLnNoAmountInvoiceCreate.mockClear()
  mockOnChainAddressCurrent.mockClear()
}

describe("payment request", () => {
  it("ln with btc receiving wallet", async () => {
    const prcd = createPaymentRequestCreationData({
      ...defaultParams,
      receivingWalletDescriptor: btcWalletDescriptor,
    })

    const pr = createPaymentRequest({ creationData: prcd, mutations })

    expect(pr.info).toBeUndefined()
    expect(pr.state).toBe(PaymentRequestState.Idle)

    const prNew = await pr.generateRequest()
    expect(prNew.info).not.toBeUndefined()
    expect(mockLnNoAmountInvoiceCreate).toHaveBeenCalled()
    expect(prNew.state).toBe(PaymentRequestState.Created)
    expect(prNew.info?.data?.invoiceType).toBe(Invoice.Lightning)
    expect(prNew.info?.data?.getFullUriFn({})).toBe(noAmountInvoice)
  })

  it("ln with usd receiving wallet", async () => {
    const prcd = createPaymentRequestCreationData({
      ...defaultParams,
      receivingWalletDescriptor: usdWalletDescriptor,
    })

    const pr = createPaymentRequest({ creationData: prcd, mutations })

    expect(pr.info).toBeUndefined()
    expect(pr.state).toBe(PaymentRequestState.Idle)

    const prNew = await pr.generateRequest()
    expect(prNew.info).not.toBeUndefined()
    expect(mockLnNoAmountInvoiceCreate).toHaveBeenCalled()
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

    const pr = createPaymentRequest({ creationData: prcd, mutations })

    expect(pr.info).toBeUndefined()
    expect(pr.state).toBe(PaymentRequestState.Idle)

    const prNew = await pr.generateRequest()
    expect(prNew.info).not.toBeUndefined()
    expect(mockLnInvoiceCreate).toHaveBeenCalled()
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

    const pr = createPaymentRequest({ creationData: prcd, mutations })

    expect(pr.info).toBeUndefined()
    expect(pr.state).toBe(PaymentRequestState.Idle)

    const prNew = await pr.generateRequest()
    expect(prNew.info).not.toBeUndefined()
    expect(mockLnUsdInvoiceCreate).toHaveBeenCalled()
    expect(prNew.state).toBe(PaymentRequestState.Created)
    expect(prNew.info?.data?.invoiceType).toBe(Invoice.Lightning)
    expect(prNew.info?.data?.getFullUriFn({})).toBe(usdAmountInvoice)
  })

  it("ln with usd receiving wallet - set expiration time", async () => {
    const prcd = createPaymentRequestCreationData({
      ...defaultParams,
      receivingWalletDescriptor: usdWalletDescriptor,
      unitOfAccountAmount: toUsdMoneyAmount(1),
      expirationTime: 5,
    })

    const pr = createPaymentRequest({ creationData: prcd, mutations })

    expect(pr.info).toBeUndefined()
    expect(pr.state).toBe(PaymentRequestState.Idle)

    const prNew = await pr.generateRequest()

    const expiresAt =
      prNew?.info?.data?.invoiceType === Invoice.Lightning && prNew.info?.data?.expiresAt
        ? prNew.info.data.expiresAt?.toISOString()
        : null

    expect(prNew.info).not.toBeUndefined()
    expect(mockLnUsdInvoiceCreate).toHaveBeenCalled()
    expect(prNew.state).toBe(PaymentRequestState.Created)
    expect(prNew.info?.data?.invoiceType).toBe(Invoice.Lightning)
    expect(prNew.info?.data?.getFullUriFn({})).toBe(usdAmountInvoice)
    expect(expiresAt).toBe("2023-02-21T17:51:00.000Z")
  })

  it("ln with btc receiving wallet - set expiration time", async () => {
    const prcd = createPaymentRequestCreationData({
      ...defaultParams,
      receivingWalletDescriptor: btcWalletDescriptor,
      unitOfAccountAmount: toUsdMoneyAmount(1),
      expirationTime: 60,
    })

    const pr = createPaymentRequest({ creationData: prcd, mutations })

    expect(pr.info).toBeUndefined()
    expect(pr.state).toBe(PaymentRequestState.Idle)

    const prNew = await pr.generateRequest()

    const expiresAt =
      prNew?.info?.data?.invoiceType === Invoice.Lightning && prNew.info?.data?.expiresAt
        ? prNew.info.data.expiresAt?.toISOString()
        : null

    expect(prNew.info).not.toBeUndefined()
    expect(mockLnInvoiceCreate).toHaveBeenCalled()
    expect(prNew.state).toBe(PaymentRequestState.Created)
    expect(prNew.info?.data?.invoiceType).toBe(Invoice.Lightning)
    expect(prNew.info?.data?.getFullUriFn({})).toBe(btcAmountInvoice)
    expect(expiresAt).toBe("2023-02-22T17:46:48.000Z")
  })

  it("paycode/lnurl", async () => {
    const prcd = createPaymentRequestCreationData({
      ...defaultParams,
      type: Invoice.PayCode,
      username: "username",
      posUrl: "posUrl",
    })

    const pr = createPaymentRequest({ creationData: prcd, mutations })
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

    const pr = createPaymentRequest({ creationData: prcd, mutations })

    expect(pr.info).toBeUndefined()
    expect(pr.state).toBe(PaymentRequestState.Idle)

    const prNew = await pr.generateRequest()
    expect(prNew.info).not.toBeUndefined()
    expect(mockOnChainAddressCurrent).toHaveBeenCalled()
    expect(prNew.state).toBe(PaymentRequestState.Created)
    expect(prNew.info?.data?.invoiceType).toBe(Invoice.OnChain)
    expect(
      prNew.info?.data?.getFullUriFn({}).startsWith(`bitcoin:${mockOnChainAddress}`),
    ).toBe(true)
  })
})
