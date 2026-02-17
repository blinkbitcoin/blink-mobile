import { Invoice } from "@app/screens/receive-bitcoin-screen/payment/index.types"
import { createPaymentRequestCreationData } from "@app/screens/receive-bitcoin-screen/payment/payment-request-creation-data"
import { toUsdMoneyAmount } from "@app/types/amounts"

import { btcWalletDescriptor, defaultParams, usdWalletDescriptor } from "./helpers"

describe("create payment request creation data", () => {
  it("ln on btc wallet", () => {
    const prcd = createPaymentRequestCreationData({
      ...defaultParams,
      defaultWalletDescriptor: btcWalletDescriptor,
    })

    expect(prcd.receivingWalletDescriptor).toBe(btcWalletDescriptor)
    expect(prcd.canSetAmount).toBe(true)
    expect(prcd.canSetMemo).toBe(true)
    expect(prcd.canSetReceivingWalletDescriptor).toBe(true)
  })

  it("ln on usd wallet", () => {
    const prcd = createPaymentRequestCreationData({
      ...defaultParams,
      defaultWalletDescriptor: usdWalletDescriptor,
    })

    expect(prcd.receivingWalletDescriptor).toBe(usdWalletDescriptor)
    expect(prcd.canSetAmount).toBe(true)
    expect(prcd.canSetMemo).toBe(true)
    expect(prcd.canSetReceivingWalletDescriptor).toBe(true)
  })

  it("ln on usd wallet with amount", () => {
    const prcd = createPaymentRequestCreationData({
      ...defaultParams,
      defaultWalletDescriptor: usdWalletDescriptor,
      unitOfAccountAmount: toUsdMoneyAmount(1),
    })

    expect(prcd.settlementAmount).toStrictEqual(toUsdMoneyAmount(1))
    expect(prcd.receivingWalletDescriptor).toBe(usdWalletDescriptor)
    expect(prcd.canSetAmount).toBe(true)
    expect(prcd.canSetMemo).toBe(true)
    expect(prcd.canSetReceivingWalletDescriptor).toBe(true)
  })

  it("cant use paycode", () => {
    const prcd = createPaymentRequestCreationData({
      ...defaultParams,
      type: Invoice.PayCode,
      defaultWalletDescriptor: usdWalletDescriptor,
      username: undefined,
    })

    expect(prcd.canUsePaycode).toBe(false)
  })

  it("can use paycode", () => {
    const prcd = createPaymentRequestCreationData({
      ...defaultParams,
      type: Invoice.PayCode,
      username: "test-username",
      defaultWalletDescriptor: usdWalletDescriptor,
    })

    expect(prcd.canUsePaycode).toBe(true)
    expect(prcd.username).toBe("test-username")
    expect(prcd.canSetAmount).toBe(true)
    expect(prcd.canSetMemo).toBe(true)
    expect(prcd.canSetReceivingWalletDescriptor).toBe(false)
    expect(prcd.receivingWalletDescriptor).toBe(btcWalletDescriptor)
  })

  it("onchain can set amount for btc", () => {
    const prcd = createPaymentRequestCreationData({
      ...defaultParams,
      type: Invoice.OnChain,
      defaultWalletDescriptor: btcWalletDescriptor,
    })

    expect(prcd.receivingWalletDescriptor).toBe(btcWalletDescriptor)
    expect(prcd.canSetAmount).toBe(true)
    expect(prcd.canSetMemo).toBe(true)
    expect(prcd.canSetReceivingWalletDescriptor).toBe(true)
  })

  it("onchain can't set amount for usd", () => {
    const prcd = createPaymentRequestCreationData({
      ...defaultParams,
      type: Invoice.OnChain,
      defaultWalletDescriptor: usdWalletDescriptor,
    })

    expect(prcd.receivingWalletDescriptor).toBe(usdWalletDescriptor)
    expect(prcd.canSetAmount).toBe(false)
    expect(prcd.canSetMemo).toBe(true)
    expect(prcd.canSetReceivingWalletDescriptor).toBe(true)
  })

  it("ln on btc wallet with expiration time", () => {
    const prcd = createPaymentRequestCreationData({
      ...defaultParams,
      defaultWalletDescriptor: btcWalletDescriptor,
      expirationTime: 60,
    })

    expect(prcd.receivingWalletDescriptor).toBe(btcWalletDescriptor)
    expect(prcd.canSetAmount).toBe(true)
    expect(prcd.canSetMemo).toBe(true)
    expect(prcd.canSetReceivingWalletDescriptor).toBe(true)
    expect(prcd.canSetExpirationTime).toBe(true)
  })

  it("ln on usd wallet with expiration time", () => {
    const prcd = createPaymentRequestCreationData({
      ...defaultParams,
      defaultWalletDescriptor: usdWalletDescriptor,
      expirationTime: 5,
    })

    expect(prcd.receivingWalletDescriptor).toBe(usdWalletDescriptor)
    expect(prcd.canSetAmount).toBe(true)
    expect(prcd.canSetMemo).toBe(true)
    expect(prcd.canSetReceivingWalletDescriptor).toBe(true)
    expect(prcd.canSetExpirationTime).toBe(true)
  })

  it("onchain can't set expiration time", () => {
    const prcd = createPaymentRequestCreationData({
      ...defaultParams,
      type: Invoice.OnChain,
      defaultWalletDescriptor: usdWalletDescriptor,
    })

    expect(prcd.receivingWalletDescriptor).toBe(usdWalletDescriptor)
    expect(prcd.canSetAmount).toBe(false)
    expect(prcd.canSetMemo).toBe(true)
    expect(prcd.canSetReceivingWalletDescriptor).toBe(true)
    expect(prcd.canSetExpirationTime).toBe(false)
  })
})
