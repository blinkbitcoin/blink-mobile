import { WalletCurrency } from "@app/graphql/generated"
import { MoneyAmount, WalletAmount, WalletOrDisplayCurrency } from "@app/types/amounts"
import { BtcWalletDescriptor, WalletDescriptor } from "@app/types/wallets"

import {
  InvoiceType,
  PaymentRequestCreationData,
  BaseCreatePaymentRequestCreationDataParams,
  ConvertMoneyAmountFn,
  Invoice,
} from "./index.types"

export const createPaymentRequestCreationData = <T extends WalletCurrency>(
  params: BaseCreatePaymentRequestCreationDataParams<T>,
): PaymentRequestCreationData<T> => {
  let receivingWalletDescriptor: WalletDescriptor<T> =
    params.receivingWalletDescriptor ?? params.defaultWalletDescriptor

  if (params.type === Invoice.PayCode) {
    receivingWalletDescriptor = params.bitcoinWalletDescriptor as WalletDescriptor<T>
  }

  const setType = (type: InvoiceType) =>
    createPaymentRequestCreationData({ ...params, type, receivingWalletDescriptor })
  const setDefaultWalletDescriptor = (defaultWalletDescriptor: WalletDescriptor<T>) =>
    createPaymentRequestCreationData({
      ...params,
      defaultWalletDescriptor,
      receivingWalletDescriptor,
    })
  const setBitcoinWalletDescriptor = (bitcoinWalletDescriptor: BtcWalletDescriptor) =>
    createPaymentRequestCreationData({
      ...params,
      bitcoinWalletDescriptor,
      receivingWalletDescriptor,
    })
  const setConvertMoneyAmount = (convertMoneyAmount: ConvertMoneyAmountFn) =>
    createPaymentRequestCreationData({
      ...params,
      convertMoneyAmount,
      receivingWalletDescriptor,
    })
  const setUsername = (username: string) =>
    createPaymentRequestCreationData({ ...params, username, receivingWalletDescriptor })

  const { type, convertMoneyAmount, memo, expirationTime } = params

  const permissions = {
    canSetReceivingWalletDescriptor: false,
    canSetMemo: true,
    canSetAmount: true,
    canSetExpirationTime: false,
  }
  if (type === Invoice.Lightning || type === Invoice.OnChain) {
    permissions.canSetReceivingWalletDescriptor = true
    permissions.canSetMemo = true
  }
  if (type === Invoice.Lightning) permissions.canSetExpirationTime = true

  const setReceivingWalletDescriptor = (receivingWalletDescriptor: WalletDescriptor<T>) =>
    createPaymentRequestCreationData({ ...params, receivingWalletDescriptor })
  let setMemo: ((memo: string) => PaymentRequestCreationData<T>) | undefined = undefined
  if (permissions.canSetMemo) {
    setMemo = (memo) =>
      createPaymentRequestCreationData({ ...params, memo, receivingWalletDescriptor })
  }
  let setAmount:
    | ((
        unitOfAccountAmount: MoneyAmount<WalletOrDisplayCurrency>,
      ) => PaymentRequestCreationData<T>)
    | undefined = undefined
  if (permissions.canSetAmount) {
    setAmount = (unitOfAccountAmount) =>
      createPaymentRequestCreationData({
        ...params,
        unitOfAccountAmount,
        receivingWalletDescriptor,
      })
  }

  const setExpirationTime = (expirationTime: number) =>
    createPaymentRequestCreationData({
      ...params,
      expirationTime,
      receivingWalletDescriptor,
    })

  if (
    type === Invoice.OnChain &&
    receivingWalletDescriptor.currency === WalletCurrency.Usd
  ) {
    permissions.canSetAmount = false
  }

  const { unitOfAccountAmount } = params
  let settlementAmount: WalletAmount<T> | undefined = undefined
  if (unitOfAccountAmount) {
    settlementAmount = convertMoneyAmount(
      unitOfAccountAmount,
      receivingWalletDescriptor.currency,
    )
  }

  return {
    ...params,
    ...permissions,
    setType,
    setBitcoinWalletDescriptor,
    setDefaultWalletDescriptor,
    setConvertMoneyAmount,
    setUsername,
    receivingWalletDescriptor,

    // optional sets
    setReceivingWalletDescriptor,
    setMemo,
    setAmount,
    setExpirationTime,

    // optional data
    unitOfAccountAmount,
    settlementAmount,
    memo,
    expirationTime,

    canUsePaycode: Boolean(params.username),
  }
}
