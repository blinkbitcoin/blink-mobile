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
  // These sets are always available
  const setType = (type: InvoiceType) =>
    createPaymentRequestCreationData({ ...params, type })
  const setDefaultWalletDescriptor = (defaultWalletDescriptor: WalletDescriptor<T>) =>
    createPaymentRequestCreationData({ ...params, defaultWalletDescriptor })
  const setBitcoinWalletDescriptor = (bitcoinWalletDescriptor: BtcWalletDescriptor) =>
    createPaymentRequestCreationData({ ...params, bitcoinWalletDescriptor })
  const setConvertMoneyAmount = (convertMoneyAmount: ConvertMoneyAmountFn) =>
    createPaymentRequestCreationData({ ...params, convertMoneyAmount })
  const setUsername = (username: string) =>
    createPaymentRequestCreationData({ ...params, username })

  const {
    type,
    defaultWalletDescriptor,
    bitcoinWalletDescriptor,
    convertMoneyAmount,
    memo,
    expirationTime,
  } = params

  // Permissions for the specified type
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

  // Permission based sets
  let setReceivingWalletDescriptor:
    | ((receivingWalletDescriptor: WalletDescriptor<T>) => PaymentRequestCreationData<T>)
    | undefined = undefined
  if (permissions.canSetReceivingWalletDescriptor) {
    setReceivingWalletDescriptor = (receivingWalletDescriptor) =>
      createPaymentRequestCreationData({ ...params, receivingWalletDescriptor })
  }
  let setMemo: ((memo: string) => PaymentRequestCreationData<T>) | undefined = undefined
  if (permissions.canSetMemo) {
    setMemo = (memo) => createPaymentRequestCreationData({ ...params, memo })
  }
  let setAmount:
    | ((
        unitOfAccountAmount: MoneyAmount<WalletOrDisplayCurrency>,
      ) => PaymentRequestCreationData<T>)
    | undefined = undefined
  if (permissions.canSetAmount) {
    setAmount = (unitOfAccountAmount) =>
      createPaymentRequestCreationData({ ...params, unitOfAccountAmount })
  }

  let setExpirationTime:
    | ((expirationTime: number) => PaymentRequestCreationData<T>)
    | undefined = undefined
  if (permissions.canSetExpirationTime) {
    setExpirationTime = (expirationTime) =>
      createPaymentRequestCreationData({ ...params, expirationTime })
  }

  // Set default receiving wallet descriptor
  let { receivingWalletDescriptor } = params
  if (!receivingWalletDescriptor) {
    receivingWalletDescriptor = defaultWalletDescriptor
  }

  // Paycode only to Bitcoin
  // FIXME: this is no longer the case
  if (type === Invoice.PayCode) {
    receivingWalletDescriptor = bitcoinWalletDescriptor as WalletDescriptor<T>
  }

  // We currently can't set amount for on-chain USD
  if (
    type === Invoice.OnChain &&
    receivingWalletDescriptor.currency === WalletCurrency.Usd
  ) {
    permissions.canSetAmount = false
  }

  // Set settlement amount if unit of account amount is set
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
