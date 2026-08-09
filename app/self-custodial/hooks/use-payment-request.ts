import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { type BreezSdkInterface } from "@breeztech/breez-sdk-spark-react-native"

import crashlytics from "@react-native-firebase/crashlytics"

import { recordAppError } from "@app/utils/error-reporting"
import { utils as lnurlUtils } from "lnurl-pay"

import { WalletCurrency } from "@app/graphql/generated"
import { useAccountRegistry } from "@app/hooks/use-account-registry"
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
import { AccountType } from "@app/types/wallet"
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
import {
  latestOnchainReceiptId,
  loadIssuedOnchainAddress,
  saveIssuedOnchainAddress,
} from "../storage/onchain-address"

import { useReceiveAssetMode } from "./use-receive-asset-mode"
import type { InvoiceData, SelfCustodialPaymentRequestState } from "./types"

/**
 * The identity of a generation: the sdk instance plus a key covering everything else the
 * invoice is derived from. Two generations are the same when both halves match, so adding
 * a new input means extending `key` — there is no field-by-field comparison to forget.
 */
type GenerationInputs = {
  sdk: BreezSdkInterface | null
  key: string
}

const buildGenerationKey = (parts: {
  type: InvoiceType
  memo: string
  amount: MoneyAmount<WalletOrDisplayCurrency> | undefined
  assetMode: ReceiveAssetMode
}): string =>
  // Serialised rather than joined so a memo containing the separator cannot make two
  // different generations look alike.
  JSON.stringify([
    parts.type,
    parts.memo,
    parts.amount ? `${parts.amount.amount}-${parts.amount.currencyCode}` : null,
    parts.assetMode,
  ])

const isSameGeneration = (a: GenerationInputs | null, b: GenerationInputs): boolean =>
  a !== null && a.sdk === b.sdk && a.key === b.key

export const usePaymentRequest = (): SelfCustodialPaymentRequestState | null => {
  const { sdk, lastReceivedPaymentId, lightningAddress, allTransactions } =
    useSelfCustodialWallet()
  const { activeAccount } = useAccountRegistry()
  const selfCustodialAccountId =
    activeAccount?.type === AccountType.SelfCustodial ? activeAccount.id : null
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
    () => ({ sdk, key: buildGenerationKey({ type, memo, amount, assetMode }) }),
    [sdk, type, memo, amount, assetMode],
  )
  const generationRef = useRef(generation)
  generationRef.current = generation

  // Holds what was last *attempted*, not what succeeded: recording the attempt is what
  // keeps a failed generation from being retried in a loop, while a change that lands
  // mid-flight leaves this mismatched and is picked up once the in-flight call settles.
  const attemptedRef = useRef<GenerationInputs | null>(null)
  const isGeneratingRef = useRef(false)

  // Lets the settle handler below re-enter the newest generateRequest, whose runGeneration
  // closure carries the current memo and amount, instead of the one it was created with.
  const generateRequestRef = useRef<(attempt: GenerationInputs) => void>(() => {})

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
   * Guards and bookkeeping around runGeneration. `attempt` is the generation the caller
   * observed, so the key recorded and the memo/amount the closure actually sends come from
   * the same render rather than being paired implicitly through the ref.
   *
   * The busy flag is cleared from a `.finally` rather than a `try/finally` inside one async
   * function because assigning a ref after an await trips eslint's require-atomic-updates —
   * keep the two split.
   */
  const generateRequest = useCallback(
    async (attempt: GenerationInputs) => {
      if (!sdk || !isReady || isAssetModeLoading || !typeInitialized) return
      if (type === Invoice.OnChain || type === Invoice.PayCode) return
      if (isGeneratingRef.current) return
      if (
        requestStateRef.current === PaymentRequestState.Converting ||
        requestStateRef.current === PaymentRequestState.Paid
      ) {
        return
      }
      attemptedRef.current = attempt
      isGeneratingRef.current = true
      setRequestState(PaymentRequestState.Loading)

      return runGeneration().finally(() => {
        isGeneratingRef.current = false
        // Anything the user changed while this call was in flight is picked up here rather
        // than by the effect below, so the retry does not depend on React happening to
        // re-run that effect after this flag is cleared rather than before.
        if (!isSameGeneration(attemptedRef.current, generationRef.current)) {
          generateRequestRef.current(generationRef.current)
        }
      })
    },
    [sdk, isReady, isAssetModeLoading, typeInitialized, type, runGeneration],
  )

  generateRequestRef.current = generateRequest

  /** Forces a fresh invoice regardless of whether anything changed (retry button). */
  const regenerateInvoice = useCallback(() => {
    generateRequestRef.current(generationRef.current)
  }, [])

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

  useEffect(() => {
    if (isSameGeneration(attemptedRef.current, generation)) return
    generateRequest(generation)
  }, [generation, generateRequest])

  /**
   * Marks how far the wallet's on-chain receive history had progressed when we last
   * issued an address. The SDK never says which address a deposit paid, so a change
   * here is our signal that the displayed address has been used.
   *
   * Being wrong in the rotating direction is cheap — the SDK keeps every address it
   * has issued under watch (see `ReceiveOnchainParams.newAddress`), so a needless
   * rotation costs an address, never a payment.
   */
  const depositMarker = useMemo(
    () => latestOnchainReceiptId(allTransactions),
    [allTransactions],
  )
  const depositMarkerRef = useRef(depositMarker)
  depositMarkerRef.current = depositMarker

  // Only the newest request may publish its address: an automatic rotation and a
  // manual tap can otherwise land out of order and show a superseded address.
  const onchainRequestIdRef = useRef(0)

  const issueOnchainAddress = useCallback(
    async (forceRotate: boolean) => {
      if (!sdk) return
      const marker = depositMarkerRef.current
      onchainRequestIdRef.current += 1
      const requestId = onchainRequestIdRef.current

      // Without an account id we cannot track reuse, so we fall back to the SDK's
      // existing address rather than leaving the QR blank.
      const issued =
        forceRotate || !selfCustodialAccountId
          ? null
          : await loadIssuedOnchainAddress(selfCustodialAccountId)
      // With no stored record we adopt whatever the SDK already holds: rotating here
      // would burn an address for a wallet that has never received anything.
      const shouldRotate =
        forceRotate || (issued !== null && issued.depositMarker !== marker)

      const result = await createReceiveOnchain(sdk)({ newAddress: shouldRotate })
      if (!result.address) return
      if (requestId !== onchainRequestIdRef.current) return

      setOnchainAddress(result.address)
      if (!selfCustodialAccountId) return
      await saveIssuedOnchainAddress(selfCustodialAccountId, {
        address: result.address,
        depositMarker: marker,
      })
    },
    [sdk, selfCustodialAccountId],
  )

  // Runs on mount and again whenever an on-chain receipt lands — covering both
  // "the deposit arrived while the QR was on screen" and "it arrived while the app
  // was closed". Re-saving the marker each time keeps this idempotent.
  useEffect(() => {
    if (!sdk) return
    issueOnchainAddress(false).catch((err) => {
      recordAppError(
        err instanceof Error
          ? err
          : new Error(`Self-custodial receive onchain adapter failed: ${err}`),
      )
    })
  }, [sdk, issueOnchainAddress, depositMarker])

  /** Manual "New address" action on the on-chain receive page. */
  const rotateOnchainAddress = useCallback(() => {
    issueOnchainAddress(true).catch((err) => {
      recordAppError(
        err instanceof Error
          ? err
          : new Error(`Self-custodial onchain address rotation failed: ${err}`),
      )
    })
  }, [issueOnchainAddress])

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
    regenerateInvoice,
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
    rotateOnchainAddress,
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
