import {
  parsePaymentDestination,
  PaymentType,
  Network as NetworkGaloyClient,
} from "@blinkbitcoin/blink-client"

import {
  InvalidDestinationReason,
  ParseDestinationParams,
  ParseDestinationResult,
} from "./index.types"
import { resolveIntraledgerDestination } from "./intraledger"
import { resolveLightningDestination } from "./lightning"
import { resolveLnurlDestination } from "./lnurl"
import { resolveOnchainDestination } from "./onchain"

export * from "./intraledger"
export * from "./lightning"
export * from "./lnurl"
export * from "./onchain"

export const parseDestination = async ({
  rawInput,
  myWalletIds,
  bitcoinNetwork,
  lnurlDomains,
  accountDefaultWalletQuery,
  inputSource,
  displayCurrency,
}: ParseDestinationParams): Promise<ParseDestinationResult> => {
  const parsedDestination = parsePaymentDestination({
    destination: rawInput,
    network: bitcoinNetwork as NetworkGaloyClient,
    lnAddressDomains: lnurlDomains,
    inputSource,
    displayCurrency,
  })

  switch (parsedDestination.paymentType) {
    case PaymentType.IntraledgerWithFlag:
      return resolveIntraledgerDestination({
        parsedIntraledgerDestination: parsedDestination,
        accountDefaultWalletQuery,
        myWalletIds,
        flag: parsedDestination.flag,
      })
    case PaymentType.Intraledger:
      return resolveIntraledgerDestination({
        parsedIntraledgerDestination: parsedDestination,
        accountDefaultWalletQuery,
        myWalletIds,
      })
    case PaymentType.Lnurl: {
      return resolveLnurlDestination({
        parsedLnurlDestination: parsedDestination,
        lnurlDomains,
        accountDefaultWalletQuery,
        myWalletIds,
      })
    }
    case PaymentType.Lightning: {
      return resolveLightningDestination(parsedDestination)
    }
    case PaymentType.Onchain: {
      return resolveOnchainDestination(parsedDestination)
    }
    default: {
      return {
        valid: false,
        invalidReason: InvalidDestinationReason.UnknownDestination,
        invalidPaymentDestination: parsedDestination,
      } as const
    }
  }
}
