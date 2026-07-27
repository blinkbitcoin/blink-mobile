import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { type BreezSdkInterface } from "@breeztech/breez-sdk-spark-react-native"

import crashlytics from "@react-native-firebase/crashlytics"

import { recordAppError } from "@app/utils/error-reporting"
import { utils as lnurlUtils } from "lnurl-pay"

import { WalletCurrency } from "@app/graphql/generated"
import { useActiveWallet } from "@app/hooks/use-active-wallet"
import { useDisplayCurrency } from "@app/hooks/use-display-currency"
import { usePriceConversion } from "@app/hooks/use-price-conversion"
import { getPaymentRequestFullUri } from "@app/screens/receive-bitcoin-screen/payment/helpers"
import {
  Invoice,
  InvoiceType,
  PaymentRequestState,
  PaymentRequestStateType,
} from "@app/screens/receive-bitcoin-screen/payment/index.types"
import {
  MoneyAmount,
  WalletOrDisplayCurrency,
  toBtcMoneyAmount,
} from "@app/types/amounts"
import { toSatsAmount } from "@app/utils/amounts"
import { buildBitcoinUri } from "@app/utils/bitcoin-uri"

import {
  addPendingAutoConvert,
  fetchAutoConvertMinSats,
  ReceiveAssetMode,
} from "../auto-convert"
import { createReceiveLightning, createReceiveOnchain } from "../bridge"
import { AutoConvertStatus, useAutoConvertStatus } from "../providers/auto-convert-status"
import { useSelfCustodialWallet } from "../providers/wallet"

import { useReceiveAssetMode } from "./use-receive-asset-mode"
import type { InvoiceData, SelfCustodialPaymentRequestState } from "./types"

type GenerationInputs = {
  sdk: BreezSdkInterface | null
  type: InvoiceType
  memo: string
  amount: string | null
  assetMode: ReceiveAssetMode
}

const isSameGeneration = (a: GenerationInputs | null, b: GenerationInputs): boolean =>
  a !== null &&
  a.sdk === b.sdk &&
  a.type === b.type &&
  a.memo === b.memo &&
  a.amount === b.amount &&
  a.assetMode === b.assetMode

export const usePaymentRequest = (): SelfCustodialPaymentRequestState | null => {
  const { sdk, lastReceivedPaymentId, lightningAddress } = useSelfCustodialWallet()
  const { wallets, isReady } = useActiveWallet()
  const { convertMoneyAmount } = usePriceConversion()
  const { formatMoneyAmount } = useDisplayCurrency()
  const {
    assetMode,
    setAssetMode,
    isToggleDisabled: isAssetToggleDisabled,
    loading: isAssetModeLoading,
  } = useReceiveAssetMode()

  const btcWallet = wallets.find((w) => w.walletCurrency === WalletCurrency.Btc)
  const usdWallet = wallets.find((w) => w.walletCurrency === WalletCurrency.Usd)

  const parsedLnAddress = lightningAddress
    ? lnurlUtils.parseLightningAddress(lightningAddress)
    : null
  const canUsePaycode = Boolean(parsedLnAddress)
  const lnAddressUsername = parsedLnAddress?.username ?? ""
  const lnAddressHostname = parsedLnAddress?.domain ?? ""

  const [type, setType] = useState<InvoiceType>(Invoice.Lightning)
  const [memo, setMemoState] = useState("")
  const [memoChangeText, setMemoChangeText] = useState<string | null>(null)
  const [amount, setAmountState] = useState<MoneyAmount<WalletOrDisplayCurrency>>()
  const [paymentRequest, setPaymentRequest] = useState<string>()
  const [onchainAddress, setOnchainAddress] = useState<string>()
  const [requestState, setRequestState] = useState<PaymentRequestStateType>(
    PaymentRequestState.Idle,
  )
  const [autoConvertMinSats, setAutoConvertMinSats] = useState<number | undefined>(
    undefined,
  )
  const [typeInitialized, setTypeInitialized] = useState(false)
  const baselinePaymentIdRef = useRef<string | null>(lastReceivedPaymentId)
  const lastPaymentIdRef = useRef(lastReceivedPaymentId)
  lastPaymentIdRef.current = lastReceivedPaymentId
  const requestStateRef = useRef<string>(PaymentRequestState.Idle)
  requestStateRef.current = requestState

  const receivingCurrency =
    assetMode === ReceiveAssetMode.Dollar ? WalletCurrency.Usd : WalletCurrency.Btc

  const convertMoneyAmountRef = useRef(convertMoneyAmount)
  convertMoneyAmountRef.current = convertMoneyAmount

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

  // The inputs a Lightning invoice is derived from. When any of them change, the invoice
  // on screen is stale and has to be replaced. The sdk is part of it because a reconnect
  // or account switch hands back a new instance whose invoices belong to a new session.
  const generation: GenerationInputs = useMemo(
    () => ({
      sdk,
      type,
      memo,
      amount: amount ? `${amount.amount}-${amount.currencyCode}` : null,
      assetMode,
    }),
    [sdk, type, memo, amount, assetMode],
  )
  const generationRef = useRef(generation)
  generationRef.current = generation

  // Holds what was last *attempted*, not what succeeded: recording the attempt is what
  // keeps a failed generation from being retried in a loop, while a change that lands
  // mid-flight leaves this mismatched and is picked up once the in-flight call settles.
  const attemptedRef = useRef<GenerationInputs | null>(null)
  const isGeneratingRef = useRef(false)

  /** Performs the SDK call itself; guards and bookkeeping live in generateRequest. */
  const runGeneration = useCallback(async () => {
    if (!sdk) return

    try {
      const convertMoneyAmount = convertMoneyAmountRef.current
      const invoiceSats =
        amount && convertMoneyAmount
          ? toSatsAmount(amount, convertMoneyAmount)
          : undefined

      const adapter = createReceiveLightning(sdk)
      const result = await adapter({
        amount: invoiceSats ? toBtcMoneyAmount(invoiceSats) : undefined,
        memo: memo || undefined,
      })
      if (!("invoice" in result) || !result.invoice) {
        crashlytics().log(
          `[Self-custodial] Lightning adapter returned no invoice (amount=${amount?.amount ?? "none"}, currency=${amount?.currencyCode ?? "none"})`,
        )
        recordAppError(
          new Error("Self-custodial invoice adapter returned no invoice field"),
        )
        setRequestState(PaymentRequestState.Error)
        return
      }

      if (assetMode === ReceiveAssetMode.Dollar) {
        await addPendingAutoConvert({
          paymentRequest: result.invoice,
          amountSats: invoiceSats,
          createdAtMs: Date.now(),
          attempts: 0,
          lastAttemptAtMs: undefined,
        })
      }

      baselinePaymentIdRef.current = lastPaymentIdRef.current
      setPaymentRequest(result.invoice)
      setRequestState(PaymentRequestState.Created)
    } catch (err) {
      crashlytics().log(
        `[Self-custodial] Lightning invoice generation failed (amount=${amount?.amount ?? "none"}, currency=${amount?.currencyCode ?? "none"})`,
      )
      recordAppError(
        err instanceof Error
          ? err
          : new Error(`Self-custodial invoice generation failed: ${err}`),
      )
      setRequestState(PaymentRequestState.Error)
    }
  }, [sdk, memo, amount, assetMode])

  /**
   * Guards and bookkeeping around runGeneration. The busy flag is cleared from a
   * `.finally` rather than a `try/finally` inside one async function because assigning a
   * ref after an await trips eslint's require-atomic-updates — keep the two split.
   */
  const generateRequest = useCallback(async () => {
    if (!sdk || !isReady || isAssetModeLoading || !typeInitialized) return
    if (type === Invoice.OnChain || type === Invoice.PayCode) return
    if (isGeneratingRef.current) return
    if (
      requestStateRef.current === PaymentRequestState.Converting ||
      requestStateRef.current === PaymentRequestState.Paid
    ) {
      return
    }
    attemptedRef.current = generationRef.current
    isGeneratingRef.current = true
    setRequestState(PaymentRequestState.Loading)

    return runGeneration().finally(() => {
      isGeneratingRef.current = false
    })
  }, [sdk, isReady, isAssetModeLoading, typeInitialized, type, runGeneration])

  const setMemo = useCallback(() => {
    setMemoState(memoChangeText || "")
  }, [memoChangeText])

  const setAmount = useCallback((newAmount: MoneyAmount<WalletOrDisplayCurrency>) => {
    setAmountState(newAmount)
  }, [])

  const switchReceivingWallet = useCallback(
    (newType: InvoiceType, currency: WalletCurrency) => {
      setType(newType)
      setAssetMode(
        currency === WalletCurrency.Usd
          ? ReceiveAssetMode.Dollar
          : ReceiveAssetMode.Bitcoin,
      )
    },
    [setAssetMode],
  )

  // Auto-snap initial type to PayCode when LN address is available and conditions are clean
  // (no amount, no memo, BTC mode). Mirrors custodial's initial PayCode default. Subsequent
  // transitions Lightning <-> PayCode are driven by useReceiveFlow on amount/memo/toggle changes.
  // typeInitialized gates generateRequest so we don't fire a Lightning invoice before the
  // PayCode decision lands on the first render.
  useEffect(() => {
    if (typeInitialized) return
    if (!canUsePaycode) {
      setTypeInitialized(true)
      return
    }
    const shouldUsePaycode =
      assetMode === ReceiveAssetMode.Bitcoin && !amount && !memoChangeText && !memo
    if (shouldUsePaycode) setType(Invoice.PayCode)
    setTypeInitialized(true)
  }, [typeInitialized, canUsePaycode, assetMode, amount, memoChangeText, memo])

  // Re-runs on requestState as well as on the inputs: when a generation settles, this
  // picks up any change (memo, amount, wallet) the user made while it was in flight.
  useEffect(() => {
    if (isSameGeneration(attemptedRef.current, generation)) return
    generateRequest()
  }, [generation, requestState, generateRequest])

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
        recordAppError(
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
    if (!sdk) return
    let cancelled = false
    fetchAutoConvertMinSats(sdk).then((minSats) => {
      if (!cancelled) setAutoConvertMinSats(minSats)
    })
    return () => {
      cancelled = true
    }
  }, [sdk])

  // Page-agnostic flags; the screen composes them with the carousel state.
  const shouldShowAutoConvertMinWarning = useMemo(() => {
    if (assetMode !== ReceiveAssetMode.Dollar) return false
    if (autoConvertMinSats === undefined) return false
    if (!amountInSats) return false
    return amountInSats < autoConvertMinSats
  }, [assetMode, autoConvertMinSats, amountInSats])

  const autoConvertMinFiat = useMemo(() => {
    if (autoConvertMinSats === undefined || !convertMoneyAmount) return undefined
    return formatMoneyAmount({
      moneyAmount: convertMoneyAmount(
        toBtcMoneyAmount(autoConvertMinSats),
        WalletCurrency.Usd,
      ),
    })
  }, [autoConvertMinSats, convertMoneyAmount, formatMoneyAmount])

  const autoConvertStatus = useAutoConvertStatus(paymentRequest)

  useEffect(() => {
    if (requestState !== PaymentRequestState.Created) return
    if (!lastReceivedPaymentId) return
    if (lastReceivedPaymentId === baselinePaymentIdRef.current) return
    const isDollarInvoice = assetMode === ReceiveAssetMode.Dollar
    setRequestState(
      isDollarInvoice ? PaymentRequestState.Converting : PaymentRequestState.Paid,
    )
  }, [lastReceivedPaymentId, requestState, assetMode])

  useEffect(() => {
    if (requestState !== PaymentRequestState.Converting) return
    if (autoConvertStatus !== AutoConvertStatus.Settled) return
    setRequestState(PaymentRequestState.Paid)
  }, [requestState, autoConvertStatus])

  const getFullUriFn = useCallback(
    (params: { uppercase?: boolean; prefix?: boolean }) => {
      if (type === Invoice.PayCode && lightningAddress) {
        return getPaymentRequestFullUri({
          type: Invoice.PayCode,
          input: lightningAddress,
          uppercase: params.uppercase,
          prefix: params.prefix,
        })
      }
      if (!paymentRequest) return ""
      return getPaymentRequestFullUri({
        type: Invoice.Lightning,
        input: paymentRequest,
        uppercase: params.uppercase,
        prefix: params.prefix,
      })
    },
    [type, lightningAddress, paymentRequest],
  )

  const getCopyableInvoiceFn = useCallback(() => {
    if (type === Invoice.PayCode && lightningAddress) return lightningAddress
    return paymentRequest ?? ""
  }, [type, lightningAddress, paymentRequest])

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

  const buildInvoiceData = (): InvoiceData | undefined => {
    if (type === Invoice.PayCode && lightningAddress) {
      return {
        invoiceType: Invoice.PayCode,
        username: lnAddressUsername,
        getFullUriFn,
        getCopyableInvoiceFn,
      }
    }
    if (paymentRequest) {
      return {
        invoiceType: type,
        paymentRequest,
        address: undefined,
        getFullUriFn,
        getCopyableInvoiceFn,
      }
    }
    return undefined
  }

  const invoiceData = buildInvoiceData()

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
    canUsePaycode,
    btcWalletId: btcWallet?.id,
    usdWalletId: usdWallet?.id,
    lnAddressHostname,
    feesInformation: undefined,
    info: invoiceData ? { data: invoiceData } : undefined,
    onchainAddress,
    getOnchainFullUriFn,
    pr: {
      state: requestState,
      info: { data: invoiceData },
    },
    isAssetToggleDisabled,
    shouldShowAutoConvertMinWarning,
    autoConvertMinSats,
    autoConvertMinFiat,
  }
}
