import { PaymentType, type ParsedPaymentDestination } from "@blinkbitcoin/blink-client"

import { getLightningAddress } from "@app/utils/pay-links"

import {
  InvalidDestinationReason,
  isSendDestination,
  type ParseDestinationResult,
  type ValidParsedPaymentDestination,
} from "./index.types"

const parsedPaymentDestination = (
  result: ParseDestinationResult,
): ValidParsedPaymentDestination | ParsedPaymentDestination | undefined => {
  if (isSendDestination(result)) return result.validDestination
  if (
    !result.valid &&
    result.invalidReason === InvalidDestinationReason.UsernameDoesNotExist
  ) {
    return result.invalidPaymentDestination
  }
  return undefined
}

const intraledgerHandle = (result: ParseDestinationResult): string | undefined => {
  const destination = parsedPaymentDestination(result)
  if (!destination) return undefined
  if (
    destination.paymentType === PaymentType.Intraledger ||
    destination.paymentType === PaymentType.IntraledgerWithFlag
  ) {
    return destination.handle
  }
  return undefined
}

/**
 * Re-resolves a bare Blink username as its Lightning Address so a self-custodial
 * account pays it over LNURL instead of the custodial intraledger mutation it has
 * no token for. A Blink username that does not resolve to a custodial account is
 * also re-tried this way, since it may belong to a self-custodial recipient.
 * Non-username destinations pass through unchanged.
 */
export const resolveUsername = async (
  result: ParseDestinationResult,
  lnAddressHostname: string,
  resolveLnAddress: (rawInput: string) => Promise<ParseDestinationResult>,
): Promise<ParseDestinationResult> => {
  const handle = intraledgerHandle(result)
  return handle
    ? resolveLnAddress(getLightningAddress(lnAddressHostname, handle))
    : result
}
