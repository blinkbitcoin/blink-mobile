import axios from "axios"
import { getParams } from "js-lnurl"
import { requestPayServiceParams, LnUrlPayServiceResponse, FetcGetArgs } from "lnurl-pay"

import {
  AccountDefaultWalletLazyQueryHookResult,
  WalletCurrency,
} from "@app/graphql/generated"
import { toBtcMoneyAmount } from "@app/types/amounts"
import {
  BareLnurlDecodeStatus,
  decodeBareLnurl,
  isHttpsUrl,
  lud17Url,
} from "@app/utils/lnurl"
import { LnurlPaymentDestination, PaymentType } from "@blinkbitcoin/blink-client"

import { createLnurlPaymentDetails } from "../payment-details"
import {
  CreatePaymentDetailParams,
  DestinationDirection,
  InvalidDestinationReason,
  ParseDestinationResult,
  PaymentDestination,
  ReceiveDestination,
  ResolvedLnurlPaymentDestination,
} from "./index.types"
import { resolveIntraledgerDestination } from "./intraledger"

export type ResolveLnurlDestinationParams = {
  parsedLnurlDestination: LnurlPaymentDestination
  lnurlDomains: string[]
  accountDefaultWalletQuery: AccountDefaultWalletLazyQueryHookResult[0]
  myWalletIds: string[]
}

const SERVER_ERROR_STATUS = 500
const LNURL_ERROR_STATUS = "ERROR"

type LnurlServiceFailure = Error & { readonly isLnurlServiceFailure: true }

const lnurlServiceFailure = (reason: string): LnurlServiceFailure =>
  Object.assign(new Error(reason), { isLnurlServiceFailure: true as const })

/**
 * LUD-06 lets a service report its own failure with HTTP 200 and a body of
 * {status: "ERROR"}, which is how blink's own swap provider announces an outage.
 * lnurl-pay turns that into a plain Error carrying the service's reason text,
 * indistinguishable from its own input validation by the time it reaches a caller,
 * so the distinction is drawn here while the response is still whole. The URL
 * arrives already vetted: lnurl-pay checks it is a URL and refuses onion hosts
 * before calling a fetcher, and the app vets the lnurl this was derived from.
 */
const fetchLnurlPayJson = async ({
  url,
  params,
}: FetcGetArgs): Promise<Record<string, unknown>> => {
  const { data } = await axios.get(url, { params })
  if (data?.status === LNURL_ERROR_STATUS) {
    throw lnurlServiceFailure(String(data.reason ?? ""))
  }
  return data
}

/**
 * lnurl-pay rejects for three different things: an address it cannot even build a
 * URL from, a service that answered with something that is not a pay request, and a
 * service that could not answer at all. Only the last one is worth telling the user
 * to retry, and three shapes prove it. A 5xx is the service failing out loud, a
 * {status: "ERROR"} body is the service saying so in LUD-06's own words, and a
 * rejection carrying the request but no response is the request never arriving
 * (refused, DNS, TLS, timeout). A 404 is none of those: the service answered, and
 * answered that this destination does not exist.
 */
const isLnurlServerFailure = (err: unknown): boolean => {
  const { response, request, isLnurlServiceFailure } = (err ?? {}) as {
    response?: { status?: unknown }
    request?: unknown
    isLnurlServiceFailure?: unknown
  }
  if (isLnurlServiceFailure === true) return true
  const status = response?.status
  if (typeof status === "number") return status >= SERVER_ERROR_STATUS
  return request !== undefined
}

export const resolveLnurlDestination = async ({
  parsedLnurlDestination,
  lnurlDomains,
  accountDefaultWalletQuery,
  myWalletIds,
}: ResolveLnurlDestinationParams): Promise<ParseDestinationResult> => {
  // TODO: Move all logic to galoy client or out of galoy client, currently lnurl pay is handled by galoy client
  // but lnurl withdraw is handled here

  if (parsedLnurlDestination.valid) {
    // js-lnurl and lnurl-pay fetch the URL embedded in a bare bech32 LNURL
    // verbatim, and derive a plain http URL from LUD-17 URIs whenever ".onion"
    // appears in the payload, without enforcing https in either case. Vet the
    // scheme of whatever URL the input resolves to before any network call. An
    // undecodable lnurl1 string is rejected rather than skipped: the app's
    // bech32@2 and js-lnurl's bundled bech32@1 need not agree on every input,
    // so a decode miss here must not wave the input through unchecked.
    const bareLnurl = decodeBareLnurl(parsedLnurlDestination.lnurl)
    const fetchUrl =
      bareLnurl.status === BareLnurlDecodeStatus.Decoded
        ? bareLnurl.url
        : lud17Url(parsedLnurlDestination.lnurl)

    if (
      bareLnurl.status === BareLnurlDecodeStatus.DecodeError ||
      (fetchUrl !== null && !isHttpsUrl(fetchUrl))
    ) {
      return {
        valid: false,
        invalidReason: InvalidDestinationReason.LnurlError,
        invalidPaymentDestination: parsedLnurlDestination,
      } as const
    }

    const lnurlParams = await getParams(parsedLnurlDestination.lnurl)

    // Check for lnurl withdraw request
    if ("tag" in lnurlParams && lnurlParams.tag === "withdrawRequest") {
      // The withdraw callback is fetched directly by this app or the Breez SDK;
      // require https so a malicious or downgraded service cannot redirect the
      // redemption (which carries the invoice) over cleartext. Routed through
      // LnurlError rather than LnurlUnsupported because destination-information.tsx
      // pattern-matches with `case LnurlError || LnurlUnsupported`, which leaves
      // LnurlUnsupported on the generic destination error.
      if (!isHttpsUrl(lnurlParams.callback)) {
        return {
          valid: false,
          invalidReason: InvalidDestinationReason.LnurlError,
          invalidPaymentDestination: parsedLnurlDestination,
        } as const
      }
      return createLnurlWithdrawDestination({
        lnurl: parsedLnurlDestination.lnurl,
        callback: lnurlParams.callback,
        domain: lnurlParams.domain,
        k1: lnurlParams.k1,
        defaultDescription: lnurlParams.defaultDescription,
        minWithdrawable: lnurlParams.minWithdrawable,
        maxWithdrawable: lnurlParams.maxWithdrawable,
      })
    }

    // Check for lnurl pay request. The request is guarded on its own so a service
    // that failed on its own side can be told apart from a destination that is not
    // payable. Merchant till codes resolve through this call, and reporting the
    // merchant service's own outage as "not a valid Bitcoin address or Lightning
    // invoice" is what sent a shopper looking for a parser bug that was not there.
    let lnurlPayParams: LnUrlPayServiceResponse
    try {
      lnurlPayParams = await requestPayServiceParams({
        lnUrlOrAddress: parsedLnurlDestination.lnurl,
        fetchGet: fetchLnurlPayJson,
      })
    } catch (err) {
      const isServiceFailure = isLnurlServerFailure(err)
      return {
        valid: false,
        invalidReason: isServiceFailure
          ? InvalidDestinationReason.LnurlServiceError
          : InvalidDestinationReason.LnurlUnsupported,
        invalidPaymentDestination: parsedLnurlDestination,
      } as const
    }

    try {
      // Same https requirement for the pay callback: the Breez SDK fetches it
      // on self-custodial sends, and the backend on custodial ones. LnurlError
      // rather than LnurlUnsupported for the reason given above.
      if (!isHttpsUrl(lnurlPayParams.callback)) {
        return {
          valid: false,
          invalidReason: InvalidDestinationReason.LnurlError,
          invalidPaymentDestination: parsedLnurlDestination,
        } as const
      }

      const maybeIntraledgerDestination = await tryGetIntraLedgerDestinationFromLnurl({
        lnurlDomains,
        lnurlPayParams,
        myWalletIds,
        accountDefaultWalletQuery,
      })
      if (maybeIntraledgerDestination && maybeIntraledgerDestination.valid) {
        return maybeIntraledgerDestination
      }

      return createLnurlPaymentDestination({
        lnurlParams: lnurlPayParams,
        ...parsedLnurlDestination,
      })
    } catch {
      // Resolving the account behind the lnurl is a separate lookup against our own
      // backend, and its failure is not a statement about the lnurl. Kept swallowed,
      // as it was before.
    }

    return {
      valid: false,
      invalidReason: InvalidDestinationReason.LnurlUnsupported,
      invalidPaymentDestination: parsedLnurlDestination,
    } as const
  }

  return {
    valid: false,
    invalidReason: InvalidDestinationReason.LnurlError,
    invalidPaymentDestination: parsedLnurlDestination,
  } as const
}

type tryGetIntraLedgerDestinationFromLnurlParams = {
  lnurlPayParams: LnUrlPayServiceResponse
  lnurlDomains: string[]
  accountDefaultWalletQuery: AccountDefaultWalletLazyQueryHookResult[0]
  myWalletIds: string[]
}

// TODO: move to galoy-client
const tryGetIntraLedgerDestinationFromLnurl = ({
  lnurlPayParams,
  lnurlDomains,
  accountDefaultWalletQuery,
  myWalletIds,
}: tryGetIntraLedgerDestinationFromLnurlParams) => {
  const intraLedgerHandleFromLnurl = getIntraLedgerHandleIfLnurlIsOurOwn({
    lnurlPayParams,
    lnurlDomains,
  })

  if (intraLedgerHandleFromLnurl) {
    return resolveIntraledgerDestination({
      parsedIntraledgerDestination: {
        paymentType: PaymentType.Intraledger,
        handle: intraLedgerHandleFromLnurl,
        valid: true,
      },
      accountDefaultWalletQuery,
      myWalletIds,
    })
  }

  return undefined
}

const getIntraLedgerHandleIfLnurlIsOurOwn = ({
  lnurlPayParams,
  lnurlDomains,
}: {
  lnurlPayParams: LnUrlPayServiceResponse
  lnurlDomains: string[]
}) => {
  const [username, domain] = lnurlPayParams.identifier.split("@")
  if (domain && lnurlDomains.includes(domain)) {
    return username
  }
  return undefined
}

export const createLnurlPaymentDestination = (
  resolvedLnurlPaymentDestination: ResolvedLnurlPaymentDestination & { valid: true },
): PaymentDestination => {
  const createPaymentDetail = <T extends WalletCurrency>({
    convertMoneyAmount,
    sendingWalletDescriptor,
  }: CreatePaymentDetailParams<T>) => {
    const minAmount = resolvedLnurlPaymentDestination.lnurlParams.min || 0

    return createLnurlPaymentDetails({
      lnurl: resolvedLnurlPaymentDestination.lnurl,
      lnurlParams: resolvedLnurlPaymentDestination.lnurlParams,
      sendingWalletDescriptor,
      destinationSpecifiedMemo: resolvedLnurlPaymentDestination.lnurlParams.description,
      convertMoneyAmount,
      unitOfAccountAmount: toBtcMoneyAmount(minAmount),
      isMerchant: resolvedLnurlPaymentDestination.isMerchant,
    })
  }
  return {
    valid: true,
    destinationDirection: DestinationDirection.Send,
    validDestination: resolvedLnurlPaymentDestination,
    createPaymentDetail,
  } as const
}

export type CreateLnurlWithdrawDestinationParams = {
  lnurl: string
  callback: string
  domain: string
  k1: string
  defaultDescription: string
  minWithdrawable: number
  maxWithdrawable: number
}

export const createLnurlWithdrawDestination = (
  params: CreateLnurlWithdrawDestinationParams,
): ReceiveDestination => {
  return {
    valid: true,
    destinationDirection: DestinationDirection.Receive,
    validDestination: {
      ...params,
      paymentType: PaymentType.Lnurl,
      valid: true,
    },
  } as const
}
