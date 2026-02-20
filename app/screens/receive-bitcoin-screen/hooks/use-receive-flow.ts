import { useCallback } from "react"

import { WalletCurrency } from "@app/graphql/generated"
import {
  MoneyAmount,
  WalletOrDisplayCurrency,
  isNonZeroMoneyAmount,
} from "@app/types/amounts"

import { Invoice, PaymentRequestState } from "../payment/index.types"
import { usePaymentActions } from "./use-payment-actions"
import { useLnurlWithdraw } from "./use-lnurl-withdraw"
import { usePaymentRequest } from "./use-payment-request"

type RequestState = NonNullable<ReturnType<typeof usePaymentRequest>>

type CarouselContext = {
  isOnChainPage: boolean
  onchainWalletCurrency: WalletCurrency
  syncOnchainWallet: (currency: WalletCurrency) => void
  onchainAddress: string | null
}

export const useReceiveFlow = (
  request: RequestState,
  {
    isOnChainPage,
    onchainWalletCurrency,
    syncOnchainWallet,
    onchainAddress,
  }: CarouselContext,
) => {
  const {
    pr,
    setAmount,
    setType,
    setMemo,
    switchReceivingWallet,
    type: requestType,
    state: requestState,
    canUsePaycode,
    memoChangeText,
    unitOfAccountAmount,
    receivingWalletDescriptor,
  } = request

  const activeCopyableContent = isOnChainPage
    ? onchainAddress ?? undefined
    : pr?.info?.data?.getCopyableInvoiceFn()

  const activeInvoiceType = isOnChainPage ? Invoice.OnChain : requestType

  const { copyToClipboard: handleCopy, share: handleShare } = usePaymentActions({
    copyableContent: activeCopyableContent,
    invoiceType: activeInvoiceType,
  })

  const receiveViaNFC = useLnurlWithdraw(pr)

  const isReady = requestState !== PaymentRequestState.Loading

  const handleSetAmount = useCallback(
    (amount: MoneyAmount<WalletOrDisplayCurrency>) => {
      setAmount(amount)
      if (isNonZeroMoneyAmount(amount) && requestType === Invoice.PayCode) {
        setType(Invoice.Lightning)
        return
      }
      if (
        !isNonZeroMoneyAmount(amount) &&
        requestType === Invoice.Lightning &&
        canUsePaycode &&
        !memoChangeText
      ) {
        setType(Invoice.PayCode)
      }
    },
    [setAmount, setType, requestType, canUsePaycode, memoChangeText],
  )

  const handleMemoBlur = useCallback(() => {
    setMemo()
    if (memoChangeText && requestType === Invoice.PayCode) {
      setType(Invoice.Lightning)
      return
    }
    if (
      !memoChangeText &&
      requestType === Invoice.Lightning &&
      canUsePaycode &&
      !isNonZeroMoneyAmount(unitOfAccountAmount)
    ) {
      setType(Invoice.PayCode)
    }
  }, [setMemo, setType, memoChangeText, requestType, canUsePaycode, unitOfAccountAmount])

  const handleToggleWallet = useCallback(() => {
    if (!isReady) return

    const current = isOnChainPage
      ? onchainWalletCurrency
      : receivingWalletDescriptor.currency
    const next = current === WalletCurrency.Btc ? WalletCurrency.Usd : WalletCurrency.Btc

    const hasContent = isNonZeroMoneyAmount(unitOfAccountAmount) || memoChangeText
    const revertToPaycode = next === WalletCurrency.Btc && canUsePaycode && !hasContent

    switchReceivingWallet(revertToPaycode ? Invoice.PayCode : Invoice.Lightning, next)
    syncOnchainWallet(next)
  }, [
    isReady,
    isOnChainPage,
    onchainWalletCurrency,
    syncOnchainWallet,
    receivingWalletDescriptor.currency,
    switchReceivingWallet,
    canUsePaycode,
    unitOfAccountAmount,
    memoChangeText,
  ])

  return {
    handleSetAmount,
    handleMemoBlur,
    handleToggleWallet,
    handleCopy,
    handleShare,
    receiveViaNFC,
  }
}
