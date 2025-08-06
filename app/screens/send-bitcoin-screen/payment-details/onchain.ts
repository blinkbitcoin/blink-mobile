import { WalletCurrency } from "@app/graphql/generated"
import {
  BtcMoneyAmount,
  MoneyAmount,
  WalletOrDisplayCurrency,
  toWalletAmount,
} from "@app/types/amounts"
import { PaymentType } from "@blinkbitcoin/blink-client"

import {
  ConvertMoneyAmount,
  PaymentDetail,
  SetAmount,
  SetSendingWalletDescriptor,
  BaseCreatePaymentDetailsParams,
  PaymentDetailSendPaymentGetFee,
  PaymentDetailSetMemo,
  SendPaymentMutation,
  GetFee,
} from "./index.types"

export type CreateNoAmountOnchainPaymentDetailsParams<T extends WalletCurrency> = {
  address: string
  isSendingMax?: boolean
  unitOfAccountAmount: MoneyAmount<WalletOrDisplayCurrency>
} & BaseCreatePaymentDetailsParams<T>

export const createNoAmountOnchainPaymentDetails = <T extends WalletCurrency>(
  params: CreateNoAmountOnchainPaymentDetailsParams<T>,
): PaymentDetail<T> => {
  const {
    convertMoneyAmount,
    sendingWalletDescriptor,
    destinationSpecifiedMemo,
    unitOfAccountAmount,
    senderSpecifiedMemo,
    isSendingMax,
    address,
  } = params

  const settlementAmount = convertMoneyAmount(
    unitOfAccountAmount,
    sendingWalletDescriptor.currency,
  )
  const memo = destinationSpecifiedMemo || senderSpecifiedMemo

  let sendPaymentAndGetFee: PaymentDetailSendPaymentGetFee<T> = {
    canSendPayment: false,
    canGetFee: false,
  }

  if (isSendingMax) {
    const sendPaymentMutation: SendPaymentMutation = async (paymentMutations) => {
      const { data } = await paymentMutations.onChainPaymentSendAll({
        variables: {
          input: {
            walletId: sendingWalletDescriptor.id,
            address,
            memo,
          },
        },
      })

      return {
        status: data?.onChainPaymentSendAll.status,
        errors: data?.onChainPaymentSendAll.errors,
        transaction: data?.onChainPaymentSendAll.transaction,
      }
    }

    const getFee: GetFee<T> = async (getFeeFns) => {
      if (sendingWalletDescriptor.currency === WalletCurrency.Btc) {
        const { data } = await getFeeFns.onChainTxFee({
          variables: {
            walletId: sendingWalletDescriptor.id,
            address,
            amount: settlementAmount.amount,
          },
        })

        const rawAmount = data?.onChainTxFee.amount
        const amount =
          typeof rawAmount === "number" // FIXME: this branch is never taken? rawAmount is type number | undefined
            ? toWalletAmount({
                amount: rawAmount,
                currency: sendingWalletDescriptor.currency,
              })
            : rawAmount

        return {
          amount,
        }
      } else if (sendingWalletDescriptor.currency === WalletCurrency.Usd) {
        const { data } = await getFeeFns.onChainUsdTxFee({
          variables: {
            walletId: sendingWalletDescriptor.id,
            address,
            amount: settlementAmount.amount,
          },
        })

        const rawAmount = data?.onChainUsdTxFee.amount
        const amount =
          typeof rawAmount === "number" // FIXME: this branch is never taken? rawAmount is type number | undefined
            ? toWalletAmount({
                amount: rawAmount,
                currency: sendingWalletDescriptor.currency,
              })
            : rawAmount

        return {
          amount,
        }
      }

      return { amount: null }
    }

    sendPaymentAndGetFee = {
      canSendPayment: true,
      canGetFee: true,
      sendPaymentMutation,
      getFee,
    }
  } else if (
    settlementAmount.amount &&
    sendingWalletDescriptor.currency === WalletCurrency.Btc
  ) {
    const sendPaymentMutation: SendPaymentMutation = async (paymentMutations) => {
      const { data } = await paymentMutations.onChainPaymentSend({
        variables: {
          input: {
            walletId: sendingWalletDescriptor.id,
            address,
            amount: settlementAmount.amount,
            memo,
          },
        },
      })

      return {
        status: data?.onChainPaymentSend.status,
        errors: data?.onChainPaymentSend.errors,
        transaction: data?.onChainPaymentSend.transaction,
        extraInfo: {
          arrivalAtMempoolEstimate:
            data?.onChainPaymentSend.transaction?.settlementVia.__typename ===
              "SettlementViaOnChain" &&
            data.onChainPaymentSend.transaction.settlementVia.arrivalInMempoolEstimatedAt
              ? data.onChainPaymentSend.transaction.settlementVia
                  .arrivalInMempoolEstimatedAt
              : undefined,
        },
      }
    }

    const getFee: GetFee<T> = async (getFeeFns) => {
      const { data } = await getFeeFns.onChainTxFee({
        variables: {
          walletId: sendingWalletDescriptor.id,
          address,
          amount: settlementAmount.amount,
        },
      })

      const rawAmount = data?.onChainTxFee.amount
      const amount =
        typeof rawAmount === "number" // FIXME: this branch is never taken? rawAmount is type number | undefined
          ? toWalletAmount({
              amount: rawAmount,
              currency: sendingWalletDescriptor.currency,
            })
          : rawAmount

      return {
        amount,
      }
    }

    sendPaymentAndGetFee = {
      canSendPayment: true,
      canGetFee: true,
      sendPaymentMutation,
      getFee,
    }
  } else if (
    settlementAmount.amount &&
    sendingWalletDescriptor.currency === WalletCurrency.Usd
  ) {
    let sendPaymentMutation: SendPaymentMutation
    let getFee: GetFee<T>

    if (settlementAmount.currency === WalletCurrency.Usd) {
      sendPaymentMutation = async (paymentMutations) => {
        const { data } = await paymentMutations.onChainUsdPaymentSend({
          variables: {
            input: {
              walletId: sendingWalletDescriptor.id,
              address,
              amount: settlementAmount.amount,
            },
          },
        })

        return {
          status: data?.onChainUsdPaymentSend.status,
          errors: data?.onChainUsdPaymentSend.errors,
          transaction: data?.onChainUsdPaymentSend.transaction,
        }
      }

      getFee = async (getFeeFns) => {
        const { data } = await getFeeFns.onChainUsdTxFee({
          variables: {
            walletId: sendingWalletDescriptor.id,
            address,
            amount: settlementAmount.amount,
          },
        })

        const rawAmount = data?.onChainUsdTxFee.amount
        const amount =
          typeof rawAmount === "number" // FIXME: this branch is never taken? rawAmount is type number | undefined
            ? toWalletAmount({
                amount: rawAmount,
                currency: sendingWalletDescriptor.currency,
              })
            : rawAmount

        return {
          amount,
        }
      }
    } else {
      sendPaymentMutation = async (paymentMutations) => {
        const { data } = await paymentMutations.onChainUsdPaymentSendAsBtcDenominated({
          variables: {
            input: {
              walletId: sendingWalletDescriptor.id,
              address,
              amount: settlementAmount.amount,
            },
          },
        })

        return {
          status: data?.onChainUsdPaymentSendAsBtcDenominated.status,
          errors: data?.onChainUsdPaymentSendAsBtcDenominated.errors,
          transaction: data?.onChainUsdPaymentSendAsBtcDenominated.transaction,
        }
      }

      getFee = async (getFeeFns) => {
        const { data } = await getFeeFns.onChainUsdTxFeeAsBtcDenominated({
          variables: {
            walletId: sendingWalletDescriptor.id,
            address,
            amount: settlementAmount.amount,
          },
        })

        const rawAmount = data?.onChainUsdTxFeeAsBtcDenominated.amount
        const amount =
          typeof rawAmount === "number" // FIXME: this branch is never taken? rawAmount is type number | undefined
            ? toWalletAmount({
                amount: rawAmount,
                currency: sendingWalletDescriptor.currency,
              })
            : rawAmount

        return {
          amount,
        }
      }
    }

    sendPaymentAndGetFee = {
      canSendPayment: true,
      canGetFee: true,
      sendPaymentMutation,
      getFee,
    }
  }

  const setAmount: SetAmount<T> | undefined = (
    newUnitOfAccountAmount,
    sendMax = false,
  ) => {
    return createNoAmountOnchainPaymentDetails({
      ...params,
      isSendingMax: sendMax,
      unitOfAccountAmount: newUnitOfAccountAmount,
    })
  }

  const setMemo: PaymentDetailSetMemo<T> = destinationSpecifiedMemo
    ? { canSetMemo: false }
    : {
        setMemo: (newMemo) =>
          createNoAmountOnchainPaymentDetails({
            ...params,
            senderSpecifiedMemo: newMemo,
          }),
        canSetMemo: true,
      }

  const setConvertMoneyAmount = (newConvertMoneyAmount: ConvertMoneyAmount) => {
    return createNoAmountOnchainPaymentDetails({
      ...params,
      convertMoneyAmount: newConvertMoneyAmount,
    })
  }

  const setSendingWalletDescriptor: SetSendingWalletDescriptor<T> = (
    newSendingWalletDescriptor,
  ) => {
    return createNoAmountOnchainPaymentDetails({
      ...params,
      sendingWalletDescriptor: newSendingWalletDescriptor,
    })
  }

  return {
    destination: address,
    settlementAmount,
    settlementAmountIsEstimated: sendingWalletDescriptor.currency !== WalletCurrency.Btc,
    unitOfAccountAmount,
    sendingWalletDescriptor,
    memo,
    paymentType: PaymentType.Onchain,
    setSendingWalletDescriptor,
    convertMoneyAmount,
    setConvertMoneyAmount,
    ...setMemo,
    setAmount,
    canSetAmount: true,
    ...sendPaymentAndGetFee,
    canSendMax: true,
    isSendingMax,
  } as const
}

export type CreateAmountOnchainPaymentDetailsParams<T extends WalletCurrency> = {
  address: string
  destinationSpecifiedAmount: BtcMoneyAmount
} & BaseCreatePaymentDetailsParams<T>

export const createAmountOnchainPaymentDetails = <T extends WalletCurrency>(
  params: CreateAmountOnchainPaymentDetailsParams<T>,
): PaymentDetail<T> => {
  const {
    destinationSpecifiedAmount,
    convertMoneyAmount,
    sendingWalletDescriptor,
    destinationSpecifiedMemo,
    senderSpecifiedMemo,
    address,
  } = params

  const settlementAmount = convertMoneyAmount(
    destinationSpecifiedAmount,
    sendingWalletDescriptor.currency,
  )
  const unitOfAccountAmount = destinationSpecifiedAmount

  const memo = destinationSpecifiedMemo || senderSpecifiedMemo

  let sendPaymentAndGetFee: PaymentDetailSendPaymentGetFee<T> = {
    canSendPayment: false,
    canGetFee: false,
  }

  let sendPaymentMutation: SendPaymentMutation
  let getFee: GetFee<T>

  if (sendingWalletDescriptor.currency === WalletCurrency.Btc) {
    sendPaymentMutation = async (paymentMutations) => {
      const { data } = await paymentMutations.onChainPaymentSend({
        variables: {
          input: {
            walletId: sendingWalletDescriptor.id,
            address,
            amount: settlementAmount.amount,
            memo,
          },
        },
      })

      return {
        status: data?.onChainPaymentSend.status,
        errors: data?.onChainPaymentSend.errors,
      }
    }

    getFee = async (getFeeFns) => {
      const { data } = await getFeeFns.onChainTxFee({
        variables: {
          walletId: sendingWalletDescriptor.id,
          address,
          amount: settlementAmount.amount,
        },
      })

      const rawAmount = data?.onChainTxFee.amount
      const amount =
        typeof rawAmount === "number"
          ? toWalletAmount({
              amount: rawAmount,
              currency: sendingWalletDescriptor.currency,
            })
          : rawAmount

      return {
        amount,
      }
    }

    sendPaymentAndGetFee = {
      canSendPayment: true,
      canGetFee: true,
      sendPaymentMutation,
      getFee,
    }
  } else {
    // sendingWalletDescriptor.currency === WalletCurrency.Usd
    sendPaymentMutation = async (paymentMutations) => {
      const { data } = await paymentMutations.onChainUsdPaymentSendAsBtcDenominated({
        variables: {
          input: {
            walletId: sendingWalletDescriptor.id,
            address,
            amount: unitOfAccountAmount.amount,
          },
        },
      })

      return {
        status: data?.onChainUsdPaymentSendAsBtcDenominated.status,
        errors: data?.onChainUsdPaymentSendAsBtcDenominated.errors,
      }
    }

    getFee = async (getFeeFns) => {
      const { data } = await getFeeFns.onChainUsdTxFeeAsBtcDenominated({
        variables: {
          walletId: sendingWalletDescriptor.id,
          address,
          amount: unitOfAccountAmount.amount,
        },
      })

      const rawAmount = data?.onChainUsdTxFeeAsBtcDenominated.amount
      const amount =
        typeof rawAmount === "number"
          ? toWalletAmount({
              amount: rawAmount,
              currency: sendingWalletDescriptor.currency,
            })
          : rawAmount

      return {
        amount,
      }
    }

    sendPaymentAndGetFee = {
      canSendPayment: true,
      canGetFee: true,
      sendPaymentMutation,
      getFee,
    }
  }

  const setMemo: PaymentDetailSetMemo<T> = destinationSpecifiedMemo
    ? {
        canSetMemo: false,
      }
    : {
        setMemo: (newMemo) =>
          createAmountOnchainPaymentDetails({
            ...params,
            senderSpecifiedMemo: newMemo,
          }),
        canSetMemo: true,
      }

  const setConvertMoneyAmount = (newConvertMoneyAmount: ConvertMoneyAmount) => {
    return createAmountOnchainPaymentDetails({
      ...params,
      convertMoneyAmount: newConvertMoneyAmount,
    })
  }

  const setSendingWalletDescriptor: SetSendingWalletDescriptor<T> = (
    newSendingWalletDescriptor,
  ) => {
    return createAmountOnchainPaymentDetails({
      ...params,
      sendingWalletDescriptor: newSendingWalletDescriptor,
    })
  }

  return {
    destination: address,
    destinationSpecifiedAmount,
    settlementAmount,
    settlementAmountIsEstimated: sendingWalletDescriptor.currency !== WalletCurrency.Btc,
    unitOfAccountAmount,
    sendingWalletDescriptor,
    setSendingWalletDescriptor,
    canSetAmount: false,
    convertMoneyAmount,
    setConvertMoneyAmount,
    ...setMemo,
    memo,
    paymentType: PaymentType.Onchain,
    ...sendPaymentAndGetFee,
  } as const
}
