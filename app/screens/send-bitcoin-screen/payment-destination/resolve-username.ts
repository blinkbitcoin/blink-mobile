import { PaymentType } from "@blinkbitcoin/blink-client"

import { getLightningAddress } from "@app/utils/pay-links"

import { isSendDestination, type ParseDestinationResult } from "./index.types"

const intraledgerHandle = (result: ParseDestinationResult): string | undefined => {
  if (!isSendDestination(result)) return undefined
  const { validDestination } = result
  if (
    validDestination.paymentType === PaymentType.Intraledger ||
    validDestination.paymentType === PaymentType.IntraledgerWithFlag
  ) {
    return validDestination.handle
  }
  return undefined
}

/**
 * Re-resolves a bare Blink username as its Lightning Address so a self-custodial
 * account pays it over LNURL instead of the custodial intraledger mutation it has
 * no token for. Non-username destinations pass through unchanged.
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
