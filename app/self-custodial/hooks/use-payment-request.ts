import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { type BreezSdkInterface } from "@breeztech/breez-sdk-spark-react-native"

import { logBreadcrumb, recordAppError } from "@app/utils/error-reporting"
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
  NewOnchainAddressResult,
  type NewOnchainAddressResultType,
  type ReceiveInvoiceInfo,
  type ReceivePaymentRequestState,
} from "@app/screens/receive-bitcoin-screen/payment/request-state.types"
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
import { measure, ScEvent, ScRail } from "../measurement"
import { AutoConvertStatus, useAutoConvertStatus } from "../providers/auto-convert-status"
import { useSelfCustodialWallet } from "../providers/wallet"
import { findLatestOnchainReceiptId } from "../providers/wallet-snapshot"
import {
  latestOnchainReceiptId,
  readIssuedOnchainAddress,
  mergeSeenPendingDepositIds,
  saveIssuedOnchainAddress,
} from "../storage/onchain-address"

import { useLightningAddressGated } from "./use-lightning-address-gate"
import { usePendingDeposits } from "./use-pending-deposits"
import { useReceiveAssetMode } from "./use-receive-asset-mode"

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

/**
 * How long one on-chain address request may take to get its answer from the SDK,
 * counted from when the request ahead of it has its own answer. The SDK call has no
 * timeout of its own, and without one a single hung call would stall every request
 * behind it, a tap on New included, until the user leaves the screen.
 */
export const ONCHAIN_REQUEST_TIMEOUT_MS = 30_000

/**
 * The tail of each account's on-chain address queue. It belongs to the account, not to the
 * receive screen or to one SDK connection: a request runs on after the screen that made it
 * is gone, or after a reconnect has handed the account a new SDK, and whatever asks next
 * has to start from where that request leaves the wallet. Otherwise it reads back the
 * address a tap was replacing, shows it, and the late rotation then overwrites the record
 * behind it. Different accounts never wait on each other.
 */
type OnchainQueue = {
  /** Settles once the last request has stopped. The next SDK call waits for this. */
  stopped: Promise<unknown>
  /**
   * Settles once the last request's caller has its answer, at its deadline at the latest.
   * The next request's deadline starts here rather than at `stopped`, so a call that
   * ignores its cancellation cannot leave the requests behind it with no deadline at all.
   */
  answered: Promise<unknown>
}
let onchainQueues = new Map<string, OnchainQueue>()

/** Drops every queue. For test isolation: a request one spec leaves hanging would
 *  otherwise hold up the next spec's requests on the same mock account. */
export const resetOnchainRequestQueues = (): void => {
  onchainQueues = new Map()
}

/** How one queued on-chain address request ended. */
const OnchainRequestOutcome = {
  Issued: "Issued",
  // A newer request owns the screen, or this one ran out of time: nothing to report.
  Skipped: "Skipped",
  Failed: "Failed",
} as const
type OnchainRequestOutcomeType =
  (typeof OnchainRequestOutcome)[keyof typeof OnchainRequestOutcome]

/**
 * One request's deadline. `signal` aborts once time is up, cancelling the SDK call;
 * `settle` is called the moment the SDK has answered, after which the deadline no
 * longer applies: the address exists, and the request goes on to record it.
 */
type OnchainRequestDeadline = { signal: AbortSignal; settle: () => void }

/**
 * Stops waiting on a read once `signal` aborts. Only for reads: the read itself runs
 * on, which is harmless because it changes nothing.
 */
const unlessAborted = <T>(promise: Promise<T>, signal: AbortSignal): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const onAbort = () =>
      reject(new Error("Self-custodial onchain address request aborted"))
    if (signal.aborted) {
      onAbort()
      return
    }
    signal.addEventListener("abort", onAbort)
    promise
      .then(resolve, reject)
      .finally(() => signal.removeEventListener("abort", onAbort))
  })

/**
 * The deposit marker the rotation decision is made against.
 *
 * The loaded history is one page deep, so it answers "has money arrived on-chain?"
 * only while an on-chain receipt is still near the top of it. A wallet that keeps
 * paying over Lightning pushes that receipt off the page, and the marker would go
 * blind for as long as it stayed there — handing out the paid address again. Reading
 * through to the SDK covers that gap; a receipt already on the page is by definition
 * the newest one, so the extra query is skipped.
 *
 * Failure resolves to null, which the caller reads as "we do not know yet" — never as
 * "nothing has arrived" — so a lookup that cannot run leaves the address as it is.
 */
const resolveDepositMarker = async (
  sdk: BreezSdkInterface,
  loadedMarker: string | null,
): Promise<string | null> => {
  if (loadedMarker !== null) return loadedMarker
  try {
    return await findLatestOnchainReceiptId(sdk)
  } catch (err) {
    recordAppError(
      err instanceof Error
        ? err
        : new Error(`Self-custodial onchain deposit marker lookup failed: ${err}`),
    )
    return null
  }
}

export const usePaymentRequest = (): ReceivePaymentRequestState | null => {
  const {
    sdk,
    connectedAccountId,
    lastReceivedPaymentId,
    lightningAddress,
    allTransactions,
  } = useSelfCustodialWallet()
  const { activeAccount } = useAccountRegistry()
  const selfCustodialAccountId =
    activeAccount?.type === AccountType.SelfCustodial ? activeAccount.id : null
  /**
   * The account on-chain addresses are asked for and recorded under: the active one, once
   * the SDK is connected as it. On the commit that switches accounts the provider still
   * hands over the previous connection, and a request then would take one account's
   * address and file it under the other.
   */
  const onchainAccountId =
    selfCustodialAccountId !== null && connectedAccountId === selfCustodialAccountId
      ? selfCustodialAccountId
      : null
  const { wallets, isReady } = useActiveWallet()
  const { convertMoneyAmount } = usePriceConversion()
  const { formatMoneyAmount } = useDisplayCurrency()
  const {
    assetMode,
    setAssetMode,
    isToggleDisabled: isAssetToggleDisabled,
    loading: isAssetModeLoading,
  } = useReceiveAssetMode()
  const isLightningAddressGated = useLightningAddressGated()

  const btcWallet = wallets.find((w) => w.walletCurrency === WalletCurrency.Btc)
  const usdWallet = wallets.find((w) => w.walletCurrency === WalletCurrency.Usd)

  const parsedLnAddress = lightningAddress
    ? lnurlUtils.parseLightningAddress(lightningAddress)
    : null
  /** The one gate on the address as a receive method: it drives the initial snap to
   *  PayCode, every later transition back to it, and the QR the screen offers. */
  const canUsePaycode = Boolean(parsedLnAddress) && !isLightningAddressGated
  const lnAddressUsername = parsedLnAddress?.username ?? ""
  const lnAddressHostname = parsedLnAddress?.domain ?? ""

  const [type, setType] = useState<InvoiceType>(Invoice.Lightning)
  const [memo, setMemoState] = useState("")
  const [memoChangeText, setMemoChangeText] = useState<string | null>(null)
  const [amount, setAmountState] = useState<MoneyAmount<WalletOrDisplayCurrency>>()
  const [paymentRequest, setPaymentRequest] = useState<string>()
  /**
   * The on-chain address on screen, and whether the newest request settled without one
   * (so the screen stops waiting). Kept with the account it belongs to: the render that
   * switches accounts already shows nothing, rather than the previous account's address.
   */
  const [onchainState, setOnchainState] = useState<{
    accountId: string
    address?: string
    failed: boolean
  } | null>(null)
  const ownOnchainState =
    onchainState !== null && onchainState.accountId === onchainAccountId
      ? onchainState
      : null
  const onchainAddress = ownOnchainState?.address
  const onchainAddressFailed = ownOnchainState?.failed ?? false
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
        logBreadcrumb(
          `[Self-custodial] Lightning adapter returned no invoice (hasAmount=${Boolean(amount)}, currency=${amount?.currencyCode ?? "none"})`,
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
      logBreadcrumb(
        `[Self-custodial] Lightning invoice generation failed (hasAmount=${Boolean(amount)}, currency=${amount?.currencyCode ?? "none"})`,
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

  /**
   * An address withheld while it is the displayed method has to be given up, not merely
   * left unselected: generateRequest bails on PayCode, so a type parked there would keep
   * an unpayable address on screen with no invoice ever replacing it.
   *
   * Keyed on the gate rather than on canUsePaycode, which also drops while the address is
   * still resolving — the provider clears it on every account switch. Reacting to that
   * would trade a momentary blank for a session stuck on invoices.
   */
  useEffect(() => {
    if (isLightningAddressGated && type === Invoice.PayCode) setType(Invoice.Lightning)
  }, [isLightningAddressGated, type])

  useEffect(() => {
    if (isSameGeneration(attemptedRef.current, generation)) return
    generateRequest(generation)
  }, [generation, generateRequest])

  /**
   * Marks how far the wallet's on-chain receive history had progressed when we last
   * issued an address. The SDK never says which address a deposit paid, so a change
   * here is our signal that the displayed address has been used.
   *
   * This reads the history the app has loaded, which is what makes a deposit landing
   * while the QR is on screen re-run the effect below. It is only ever half the
   * answer: `resolveDepositMarker` falls through to the SDK when this page holds no
   * on-chain receipt, since an empty page does not mean an empty history.
   *
   * Being wrong in the rotating direction is cheap — the SDK keeps every address it
   * has issued under watch (see `ReceiveOnchainParams.newAddress`), so a needless
   * rotation costs an address, never a payment.
   */
  const loadedDepositMarker = useMemo(
    () => latestOnchainReceiptId(allTransactions),
    [allTransactions],
  )
  const loadedDepositMarkerRef = useRef(loadedDepositMarker)
  loadedDepositMarkerRef.current = loadedDepositMarker

  /**
   * A deposit small enough to be fee-gated waits in `listPendingDeposits` and never
   * reaches the payment history above, so the marker alone would keep handing out the
   * address it landed on. Tracked by id (`txid:vout`) rather than by count: the listing
   * resolves empty both when nothing is pending and when it failed, and only "an id I
   * have not seen" is evidence of anything.
   */
  const { deposits: pendingDeposits } = usePendingDeposits()
  const pendingDepositIds = useMemo(
    () => pendingDeposits.map((deposit) => deposit.id),
    [pendingDeposits],
  )
  const pendingDepositIdsRef = useRef(pendingDepositIds)
  pendingDepositIdsRef.current = pendingDepositIds
  const pendingDepositKey = pendingDepositIds.join(",")

  /**
   * Address requests run one at a time, in the order they were made. The SDK answers
   * `newAddress: false` with whatever address is current when the call reaches it, so
   * a request overlapping a rotation can come back with the address it replaced and
   * put it back on screen. Run in order, each request starts from the one before it.
   *
   * The queue is the account's (see `onchainQueues`), so this holds across screens and
   * reconnects too: a request left running by a screen the user backed out of still
   * finishes first.
   *
   * Only the newest request may publish, unless it was the user asking for a fresh
   * address: a background request queued behind another adds nothing the later one
   * will not redo, but a tap must show the address it created. Neither publishes once
   * the SDK or the account it ran for has been replaced.
   */
  const onchainRequestIdRef = useRef(0)
  const onchainOwnerRef = useRef({ sdk, accountId: onchainAccountId })
  onchainOwnerRef.current = { sdk, accountId: onchainAccountId }

  // `forceNew` is the user asking for a fresh address: earlier addresses stay valid, so it
  // skips the reuse checks and no more.
  const requestOnchainAddress = useCallback(
    async (
      requestId: number,
      forceNew: boolean,
      { signal, settle }: OnchainRequestDeadline,
    ): Promise<OnchainRequestOutcomeType> => {
      const accountId = onchainAccountId
      if (!sdk || !accountId) return OnchainRequestOutcome.Failed
      const isSuperseded = () =>
        onchainOwnerRef.current.sdk !== sdk ||
        onchainOwnerRef.current.accountId !== accountId ||
        (!forceNew && requestId !== onchainRequestIdRef.current)
      if (signal.aborted || isSuperseded()) return OnchainRequestOutcome.Skipped
      const pendingIds = pendingDepositIdsRef.current

      const marker = await unlessAborted(
        resolveDepositMarker(sdk, loadedDepositMarkerRef.current),
        signal,
      )

      const read = await unlessAborted(readIssuedOnchainAddress(accountId), signal)
      const issued = read.ok ? read.issued : null
      const seenPendingIds = issued?.seenPendingDepositIds ?? []

      /**
       * Rotate only on positive evidence that this address has been used:
       *
       * - a `null` marker means neither the loaded history nor the SDK lookback behind
       *   it could name an on-chain receipt (cold start, a reconnect, a failed refresh)
       *   — "we do not know yet" is not "nothing has arrived", and treating it as such
       *   rotated on every offline visit;
       * - no stored record at all with receipts present is the first run after
       *   upgrade, where the SDK's current address may well be the paid one, so we
       *   rotate once rather than adopting it;
       * - an unclaimed deposit we have not recorded means money is sitting on the
       *   displayed address even though no payment exists for it yet.
       */
      const markerMoved = marker !== null && issued?.depositMarker !== marker
      const hasUnseenPendingDeposit = pendingIds.some(
        (id) => !seenPendingIds.includes(id),
      )
      const shouldRotate = forceNew || markerMoved || hasUnseenPendingDeposit

      // Out of time before the call went out: nothing has changed, so nothing to undo.
      if (signal.aborted) return OnchainRequestOutcome.Skipped
      const result = await createReceiveOnchain(sdk, { signal })({
        newAddress: shouldRotate,
      })
      // An answer after the deadline is not shown: the timeout has already reported this
      // request, and the caller told the user it failed.
      const abandoned = signal.aborted
      if (!abandoned) settle()
      if (!result.address) {
        if (abandoned) return OnchainRequestOutcome.Skipped
        // The adapter reports failures as an error-only result rather than throwing,
        // so without this the address request would fail in complete silence.
        recordAppError(
          new Error(
            `Self-custodial onchain address request returned no address: ${JSON.stringify(
              result.errors ?? [],
            )}`,
          ),
        )
        return OnchainRequestOutcome.Failed
      }
      // Too late, a newer request is queued behind this one and will publish from where it
      // ends, or the SDK or account changed under it. If this one rotated, the wallet has
      // moved on regardless, so it still records the address, under the account it ran
      // for: otherwise the next request reads the old record and rotates again.
      const superseded = abandoned || isSuperseded()
      if (superseded && !shouldRotate) return OnchainRequestOutcome.Skipped
      const outcome = superseded
        ? OnchainRequestOutcome.Skipped
        : OnchainRequestOutcome.Issued

      if (!superseded) {
        setOnchainState({ accountId, address: result.address, failed: false })
      }
      const saved = await saveIssuedOnchainAddress(accountId, {
        address: result.address,
        // Never let a snapshot that has not loaded erase a marker we already had:
        // the next refresh would otherwise read it back as a fresh deposit.
        depositMarker: marker ?? issued?.depositMarker ?? null,
        // Accepted cost: once this deposit is claimed it becomes a payment, the marker
        // moves, and we rotate a second time — away from an address that was never
        // used. One spare address, versus threading the deposit txid onto the shared
        // transaction type to recognise the two views of the same deposit.
        seenPendingDepositIds: mergeSeenPendingDepositIds(
          issued?.seenPendingDepositIds,
          pendingIds,
        ),
      })
      /**
       * A request is an address handed out, not a visit that shows the one issued before
       * (the first address an account gets counts too, having no record to match). It
       * counts once the record says so, while this request still owns the screen: a failed
       * read cannot tell a new address from the last one, and a failed save would let the
       * next visit count it again.
       */
      const isNewAddress = read.ok && result.address !== issued?.address
      const stillOnScreen =
        !superseded && !isSuperseded() && requestId === onchainRequestIdRef.current
      if (saved && isNewAddress && stillOnScreen) {
        measure(ScEvent.PaymentRequestCreated, {
          rail: ScRail.Onchain,
          // eslint-disable-next-line camelcase
          has_amount: false,
        })
      }
      return outcome
    },
    [sdk, onchainAccountId],
  )

  const issueOnchainAddress = useCallback(
    (forceNew = false): Promise<OnchainRequestOutcomeType> => {
      onchainRequestIdRef.current += 1
      const requestId = onchainRequestIdRef.current
      const accountId = onchainAccountId
      const markFailed = () => {
        if (!accountId || requestId !== onchainRequestIdRef.current) return
        setOnchainState((prev) => ({
          accountId,
          address: prev?.accountId === accountId ? prev.address : undefined,
          failed: true,
        }))
      }
      const controller = new AbortController()
      // The caller hears back at the deadline, even while the request is still stopping.
      const timedOut = new Promise<OnchainRequestOutcomeType>((resolve) => {
        controller.signal.addEventListener("abort", () =>
          resolve(OnchainRequestOutcome.Failed),
        )
      })
      let timer: ReturnType<typeof setTimeout> | undefined
      let deadlineOver = false
      const startDeadline = () => {
        if (timer !== undefined || deadlineOver) return
        timer = setTimeout(() => {
          recordAppError(
            new Error(
              `Self-custodial onchain address request timed out after ${ONCHAIN_REQUEST_TIMEOUT_MS}ms`,
            ),
          )
          controller.abort()
        }, ONCHAIN_REQUEST_TIMEOUT_MS)
      }
      const endDeadline = () => {
        deadlineOver = true
        clearTimeout(timer)
      }
      const queue = accountId ? onchainQueues.get(accountId) : undefined
      // The clock starts once the request ahead has its answer, even if it has not stopped:
      // a request that runs out of time waiting skips the SDK when its turn comes.
      const answeredAhead = queue?.answered ?? Promise.resolve()
      const stoppedAhead = queue?.stopped ?? Promise.resolve()
      answeredAhead.then(startDeadline)
      const request = stoppedAhead.then(async () => {
        startDeadline()
        try {
          return await requestOnchainAddress(requestId, forceNew, {
            signal: controller.signal,
            settle: endDeadline,
          })
        } catch (err) {
          // The timeout has already answered the caller and reported it.
          if (controller.signal.aborted) return OnchainRequestOutcome.Skipped
          throw err
        } finally {
          endDeadline()
        }
      })
      const answer = Promise.race([request, timedOut])
      // The queue waits for the request itself, not its deadline: one that ran out of
      // time is cancelled, and the next starts only once it has stopped, so it can no
      // longer move the wallet to another address behind the next one's back. A failed
      // request must not stall the ones queued behind it either.
      if (accountId) {
        onchainQueues.set(accountId, {
          stopped: request.catch(() => undefined),
          answered: answer.catch(() => undefined),
        })
      }
      return answer.then(
        (outcome) => {
          if (outcome === OnchainRequestOutcome.Failed) markFailed()
          return outcome
        },
        (err) => {
          markFailed()
          throw err
        },
      )
    },
    [onchainAccountId, requestOnchainAddress],
  )

  // Runs on mount and again whenever an on-chain receipt or an unclaimed deposit
  // lands — covering both "the deposit arrived while the QR was on screen" and "it
  // arrived while the app was closed". Re-saving the record keeps this idempotent.
  useEffect(() => {
    if (!sdk || !onchainAccountId) return
    issueOnchainAddress().catch((err) => {
      recordAppError(
        err instanceof Error
          ? err
          : new Error(`Self-custodial receive onchain adapter failed: ${err}`),
      )
    })
    /** A request still in flight when the screen goes (or the account changes) has no
     *  screen to show its address on: it neither displays nor counts it. */
    return () => {
      onchainRequestIdRef.current += 1
    }
  }, [sdk, onchainAccountId, issueOnchainAddress, loadedDepositMarker, pendingDepositKey])

  const generateNewOnchainAddress =
    useCallback(async (): Promise<NewOnchainAddressResultType> => {
      try {
        // A tap is never superseded, so anything short of Issued means no new address.
        const outcome = await issueOnchainAddress(true)
        return outcome === OnchainRequestOutcome.Issued
          ? NewOnchainAddressResult.Created
          : NewOnchainAddressResult.Failed
      } catch (err) {
        recordAppError(
          err instanceof Error
            ? err
            : new Error(`Self-custodial new onchain address failed: ${err}`),
        )
        return NewOnchainAddressResult.Failed
      }
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

  const buildInvoiceData = (): ReceiveInvoiceInfo | undefined => {
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
    onchainAddressFailed,
    getOnchainFullUriFn,
    generateNewOnchainAddress,
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
