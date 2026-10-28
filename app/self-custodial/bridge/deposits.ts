import {
  ClaimDeferredReason_Tags as DeferredReasonTag,
  ClaimDepositOutcome_Tags as ClaimOutcomeTag,
  ClaimDepositRequest,
  DepositClaimError_Tags as ClaimErrorTag,
  Fee,
  ListUnclaimedDepositsRequest,
  MaxFee,
  MaxOnchainFee,
  InstantClaimStatus_Tags as InstantClaimTag,
  PaymentDetails_Tags as PaymentDetailsTag,
  PaymentStatus,
  PaymentType,
  RefundDepositRequest,
  type BreezSdkInterface,
  type ClaimDepositOutcome,
  type DepositInfo,
} from "@breeztech/breez-sdk-spark-react-native"

import { reportError } from "@app/utils/error-logging"
import { toNumber } from "@app/utils/helper"

export type ClaimErrorInfo = {
  reason: "fee_exceeded" | "missing_utxo" | "below_dust" | "generic"
  requiredFeeSats?: number
  message?: string
}

export type MappedDeposit = {
  txid: string
  vout: number
  amountSats: number
  isMature: boolean
  claimError: ClaimErrorInfo | null
  hasRefund: boolean
  /**
   * How far an early (0-conf) claim has got (0.26). `settling`: the provider took the
   * deposit but its transfer has not reached the wallet, so the funds are in neither
   * the deposit nor the balance yet. `credited`: the funds are in the balance. The SDK
   * keeps both rows until the provider spends the UTXO.
   */
  earlyClaim: EarlyClaim
}

export type EarlyClaim = "none" | "settling" | "credited"

/** The SDK moves an early claim from Submitted to Claimed when the provider's transfer
 *  is claimed into this wallet. */
const mapEarlyClaim = (deposit: DepositInfo): EarlyClaim => {
  if (deposit.instantClaimStatus?.tag === InstantClaimTag.Claimed) return "credited"
  if (deposit.instantClaimStatus?.tag === InstantClaimTag.Submitted) return "settling"
  return "none"
}

const mapClaimError = (deposit: DepositInfo): ClaimErrorInfo | null => {
  if (!deposit.claimError) return null

  if (deposit.claimError.tag === ClaimErrorTag.MaxDepositClaimFeeExceeded) {
    return {
      reason: "fee_exceeded",
      requiredFeeSats: toNumber(deposit.claimError.inner.requiredFeeSats),
    }
  }

  if (deposit.claimError.tag === ClaimErrorTag.MissingUtxo) {
    return { reason: "missing_utxo" }
  }

  /** Its claim fee would leave it at or under the dust limit (0.27). */
  if (deposit.claimError.tag === ClaimErrorTag.DepositTooSmall) {
    return { reason: "below_dust" }
  }

  const inner = "inner" in deposit.claimError ? deposit.claimError.inner : null
  const message =
    inner && typeof inner === "object" && "message" in inner
      ? String((inner as Record<string, unknown>).message)
      : undefined

  return { reason: "generic", message }
}

const mapDeposit = (deposit: DepositInfo): MappedDeposit => ({
  txid: deposit.txid,
  vout: deposit.vout,
  amountSats: toNumber(deposit.amountSats),
  isMature: deposit.isMature,
  claimError: mapClaimError(deposit),
  hasRefund: Boolean(deposit.refundTxId),
  earlyClaim: mapEarlyClaim(deposit),
})

const outpointKey = (txid: string, vout: number): string => `${txid}:${vout}`

const RECEIVES_PAGE_SIZE = 50
/** 500 pages × 50 receives: far beyond any real wallet, so hitting it means the SDK
 *  stopped shortening pages and the loop would otherwise never terminate. */
const RECEIVES_MAX_PAGES = 500

/**
 * Which of `settling` have already landed as a completed receive. A Submitted deposit
 * can still be credited: the transfer may have been claimed by another device on the
 * same wallet, or while this one was offline, which leaves this device's row
 * Submitted until the UTXO is spent. Any number of receives can land after it, so
 * history is paged, newest first, until every deposit is found or it runs out. A
 * receive arriving mid-scan shifts later pages down, so it repeats an entry rather
 * than skipping one.
 *
 * A scan that stops early, on a failed page or at the page cap, is reported and still
 * returns what it found: a receive already read proves its deposit credited, and only
 * the deposits not yet found stay settling.
 */
const creditedOutpoints = async (
  sdk: BreezSdkInterface,
  settling: ReadonlySet<string>,
): Promise<Set<string>> => {
  const found = new Set<string>()
  try {
    await scanReceives(sdk, settling, found)
  } catch (err) {
    reportError("Self-custodial deposit credit lookup", err)
  }
  return found
}

/** Adds each settling outpoint it reads a completed receive for to `found`. Throws if
 *  history is still unread after the page cap. */
const scanReceives = async (
  sdk: BreezSdkInterface,
  settling: ReadonlySet<string>,
  found: Set<string>,
): Promise<void> => {
  for (let page = 0; page < RECEIVES_MAX_PAGES; page += 1) {
    const { payments } = await sdk.listPayments({
      typeFilter: [PaymentType.Receive],
      statusFilter: [PaymentStatus.Completed],
      assetFilter: undefined,
      paymentDetailsFilter: undefined,
      fromTimestamp: undefined,
      toTimestamp: undefined,
      offset: page * RECEIVES_PAGE_SIZE,
      limit: RECEIVES_PAGE_SIZE,
      sortAscending: false,
    })
    for (const { details } of payments) {
      const key =
        details?.tag === PaymentDetailsTag.Deposit
          ? outpointKey(details.inner.txId, details.inner.vout)
          : undefined
      if (key && settling.has(key)) found.add(key)
    }
    if (found.size === settling.size || payments.length < RECEIVES_PAGE_SIZE) return
  }
  throw new Error(
    `Deposit credit lookup aborted after ${RECEIVES_MAX_PAGES} pages of ${RECEIVES_PAGE_SIZE} receives`,
  )
}

export const listDeposits = async (sdk: BreezSdkInterface): Promise<MappedDeposit[]> => {
  const response = await sdk.listUnclaimedDeposits(
    ListUnclaimedDepositsRequest.create({}),
  )
  const deposits = response.deposits.map(mapDeposit)
  const settling = new Set(
    deposits
      .filter(({ earlyClaim }) => earlyClaim === "settling")
      .map(({ txid, vout }) => outpointKey(txid, vout)),
  )
  if (settling.size === 0) return deposits

  /** Unread history keeps a settling deposit listed: shown twice until the next
   *  listing reads it beats shown nowhere. */
  const credited = await creditedOutpoints(sdk, settling)
  return deposits.map((deposit) =>
    deposit.earlyClaim === "settling" &&
    credited.has(outpointKey(deposit.txid, deposit.vout))
      ? { ...deposit, earlyClaim: "credited" }
      : deposit,
  )
}

type ClaimParams = {
  sdk: BreezSdkInterface
  txid: string
  vout: number
  maxFeeSats?: number
}

export type ClaimOutcome =
  | { status: "settled" }
  | { status: "submitted" }
  | { status: "deferred"; reason: "fee_exceeded"; requiredFeeSats: number }
  | { status: "deferred"; reason: "awaiting_confirmations" }
  | { status: "deferred"; reason: "provider_declined"; message: string }

const mapClaimOutcome = (outcome: ClaimDepositOutcome): ClaimOutcome => {
  if (outcome.tag === ClaimOutcomeTag.Settled) return { status: "settled" }
  if (outcome.tag === ClaimOutcomeTag.Submitted) return { status: "submitted" }

  const { reason } = outcome.inner
  if (reason.tag === DeferredReasonTag.MaxFeeExceeded) {
    return {
      status: "deferred",
      reason: "fee_exceeded",
      requiredFeeSats: toNumber(reason.inner.requiredFeeSats),
    }
  }
  if (reason.tag === DeferredReasonTag.NoEarlyClaimAvailable) {
    return { status: "deferred", reason: "awaiting_confirmations" }
  }
  return {
    status: "deferred",
    reason: "provider_declined",
    message: reason.inner.message,
  }
}

/**
 * A max fee passed here is recorded on the deposit, so the SDK's later automatic
 * attempts on it are held to the same cap. Without one, the configured cap applies and
 * any cap recorded earlier is cleared.
 */
export const claimDeposit = async ({
  sdk,
  txid,
  vout,
  maxFeeSats,
}: ClaimParams): Promise<ClaimOutcome> => {
  /** `maxFeeSats` is a quoted claim fee, which already includes any proportional
   *  provider fee, so the ceiling takes no proportional part of its own. */
  const maxFee = maxFeeSats
    ? MaxFee.create({ onchain: new MaxOnchainFee.Fixed({ amount: BigInt(maxFeeSats) }) })
    : undefined

  const { outcome } = await sdk.claimDeposit(
    ClaimDepositRequest.create({ txid, vout, maxFee }),
  )
  return mapClaimOutcome(outcome)
}

export type NetworkFeeRates = {
  fastest: number
  halfHour: number
  hour: number
  economy: number
  minimum: number
}

export const getRecommendedFees = async (
  sdk: BreezSdkInterface,
): Promise<NetworkFeeRates> => {
  const fees = await sdk.recommendedFees()
  return {
    fastest: toNumber(fees.fastestFee),
    halfHour: toNumber(fees.halfHourFee),
    hour: toNumber(fees.hourFee),
    economy: toNumber(fees.economyFee),
    minimum: toNumber(fees.minimumFee),
  }
}

type RefundParams = {
  sdk: BreezSdkInterface
  txid: string
  vout: number
  destinationAddress: string
  feeRateSatPerVb: number
}

export const refundDeposit = async ({
  sdk,
  txid,
  vout,
  destinationAddress,
  feeRateSatPerVb,
}: RefundParams): Promise<void> => {
  await sdk.refundDeposit(
    RefundDepositRequest.create({
      txid,
      vout,
      destinationAddress,
      fee: new Fee.Rate({ satPerVbyte: BigInt(feeRateSatPerVb) }),
    }),
  )
}
