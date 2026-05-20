import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import crashlytics from "@react-native-firebase/crashlytics"

import { WalletCurrency } from "@app/graphql/generated"
import { useActiveWallet } from "@app/hooks/use-active-wallet"
import { usePriceConversion } from "@app/hooks/use-price-conversion"
import {
  Invoice,
  InvoiceType,
  PaymentRequestState,
  PaymentRequestStateType,
} from "@app/screens/receive-bitcoin-screen/payment/index.types"
import { createReceiveLightning, createReceiveOnchain } from "@app/self-custodial/bridge"
import { useSelfCustodialWallet } from "@app/self-custodial/providers/wallet-provider"
import {
  MoneyAmount,
  WalletOrDisplayCurrency,
  toBtcMoneyAmount,
} from "@app/types/amounts"
import { toSatsAmount } from "@app/utils/amounts"
import { buildBitcoinUri, buildLightningUri } from "@app/utils/bitcoin-uri"

import type { InvoiceData, SelfCustodialPaymentRequestState } from "./types"

export const usePaymentRequest = (): SelfCustodialPaymentRequestState | null => {
  const { sdk, lastReceivedPaymentId } = useSelfCustodialWallet()
  const { wallets, isReady } = useActiveWallet()
  const { convertMoneyAmount } = usePriceConversion()

  const btcWallet = wallets.find((w) => w.walletCurrency === WalletCurrency.Btc)
  const usdWallet = wallets.find((w) => w.walletCurrency === WalletCurrency.Usd)

  const [type, setType] = useState<InvoiceType>(Invoice.Lightning)
  const [memo, setMemoState] = useState("")
  const [memoChangeText, setMemoChangeText] = useState<string | null>(null)
  const [amount, setAmountState] = useState<MoneyAmount<WalletOrDisplayCurrency>>()
  const [receivingCurrency, setReceivingCurrency] = useState<WalletCurrency>(
    WalletCurrency.Btc,
  )
  const [paymentRequest, setPaymentRequest] = useState<string>()
  const [onchainAddress, setOnchainAddress] = useState<string>()
  const [requestState, setRequestState] = useState<PaymentRequestStateType>(
    PaymentRequestState.Idle,
  )
  const baselinePaymentIdRef = useRef<string | null>(lastReceivedPaymentId)
  const lastPaymentIdRef = useRef(lastReceivedPaymentId)
  lastPaymentIdRef.current = lastReceivedPaymentId

  const receivingWalletDescriptor = useMemo(
    () => ({
      id:
        (receivingCurrency === WalletCurrency.Btc ? btcWallet?.id : usdWallet?.id) ?? "",
      currency: receivingCurrency,
    }),
    [receivingCurrency, btcWallet?.id, usdWallet?.id],
  )

  const amountInSats = useMemo(
    () =>
      amount && convertMoneyAmount ? toSatsAmount(amount, convertMoneyAmount) : undefined,
    [amount, convertMoneyAmount],
  )

  const generateRequest = useCallback(async () => {
    if (!sdk || !isReady || type === Invoice.OnChain) return
    setRequestState(PaymentRequestState.Loading)

    try {
      const sats =
        amount && convertMoneyAmount
          ? toSatsAmount(amount, convertMoneyAmount)
          : undefined
      const adapter = createReceiveLightning(sdk)
      const result = await adapter({
        amount: sats ? toBtcMoneyAmount(sats) : undefined,
        memo: memo || undefined,
      })
      if (!("invoice" in result) || !result.invoice) {
        setRequestState(PaymentRequestState.Error)
        return
      }

      baselinePaymentIdRef.current = lastPaymentIdRef.current
      setPaymentRequest(result.invoice)
      setRequestState(PaymentRequestState.Created)
    } catch {
      setRequestState(PaymentRequestState.Error)
    }
  }, [sdk, isReady, type, memo, amount, convertMoneyAmount])

  const setMemo = useCallback(() => {
    setMemoState(memoChangeText || "")
  }, [memoChangeText])

  const setAmount = useCallback((newAmount: MoneyAmount<WalletOrDisplayCurrency>) => {
    setAmountState(newAmount)
  }, [])

  const switchReceivingWallet = useCallback(
    (newType: InvoiceType, currency: WalletCurrency) => {
      setType(newType)
      setReceivingCurrency(currency)
    },
    [],
  )

  useEffect(() => {
    generateRequest()
  }, [generateRequest])

  useEffect(() => {
    if (!sdk) return
    let cancelled = false
    const adapter = createReceiveOnchain(sdk)
    adapter()
      .then((result: { address?: string }) => {
        if (cancelled) return
        if (result.address) setOnchainAddress(result.address)
      })
      .catch((err) => {
        if (cancelled) return
        crashlytics().recordError(
          err instanceof Error
            ? err
            : new Error(`Self-custodial receive onchain adapter failed: ${err}`),
        )
      })
    return () => {
      cancelled = true
    }
  }, [sdk])

  useEffect(() => {
    if (requestState !== PaymentRequestState.Created) return
    if (!lastReceivedPaymentId) return
    if (lastReceivedPaymentId === baselinePaymentIdRef.current) return
    setRequestState(PaymentRequestState.Paid)
  }, [lastReceivedPaymentId, requestState])

  const getFullUriFn = useCallback(
    (params: { uppercase?: boolean; prefix?: boolean }) => {
      if (!paymentRequest) return ""
      return buildLightningUri(paymentRequest, params.prefix)
    },
    [paymentRequest],
  )

  const getCopyableInvoiceFn = useCallback(() => paymentRequest ?? "", [paymentRequest])

  const getOnchainFullUriFn = useCallback(
    (params: { uppercase?: boolean; prefix?: boolean }) => {
      if (!onchainAddress) return ""
      return buildBitcoinUri({
        address: onchainAddress,
        amountSats: amountInSats,
        memo: memo || undefined,
        uppercase: params.uppercase,
        prefix: params.prefix,
      })
    },
    [onchainAddress, amountInSats, memo],
  )

  if (!sdk || !btcWallet || !convertMoneyAmount) return null

  const invoiceData: InvoiceData | undefined = paymentRequest
    ? {
        invoiceType: type,
        paymentRequest,
        address: undefined,
        getFullUriFn,
        getCopyableInvoiceFn,
      }
    : undefined

  return {
    type,
    state: requestState,
    setType,
    setMemo,
    setAmount,
    switchReceivingWallet,
    setExpirationTime: () => {},
    regenerateInvoice: generateRequest,
    expiresInSeconds: null,
    expirationTime: 0,
    canSetExpirationTime: false,
    memo,
    memoChangeText,
    setMemoChangeText,
    convertMoneyAmount,
    settlementAmount:
      amount && convertMoneyAmount
        ? convertMoneyAmount(amount, receivingCurrency)
        : undefined,
    unitOfAccountAmount: amount,
    receivingWalletDescriptor,
    canSetAmount: true,
    canSetMemo: true,
    canUsePaycode: false,
    btcWalletId: btcWallet?.id,
    usdWalletId: usdWallet?.id,
    lnAddressHostname: "",
    feesInformation: undefined,
    info: invoiceData ? { data: invoiceData } : undefined,
    onchainAddress,
    getOnchainFullUriFn,
    pr: {
      state: requestState,
      info: { data: invoiceData },
    },
  }
}
