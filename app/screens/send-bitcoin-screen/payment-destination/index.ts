import {
  parsePaymentDestination,
  PaymentType,
  Network as NetworkGaloyClient,
} from "@blinkbitcoin/blink-client"

import {
  InvalidDestinationReason,
  DestinationDirection,
  MerchantPaymentType,
  ParseDestinationParams,
  ParseDestinationResult,
} from "./index.types"
import { resolveIntraledgerDestination } from "./intraledger"
import { resolveLightningDestination } from "./lightning"
import { resolveLnurlDestination } from "./lnurl"
import { merchantChoiceToLnurlDestination } from "./merchant"
import { resolveOnchainDestination } from "./onchain"
import { getLnurlFromUnifiedUri } from "./unified"

export * from "./intraledger"
export * from "./lightning"
export * from "./lnurl"
export * from "./onchain"
export * from "./spark"
export * from "./unified"

export const parseDestination = async ({
  rawInput,
  myWalletIds,
  bitcoinNetwork,
  lnurlDomains,
  accountDefaultWalletQuery,
  inputSource,
  displayCurrency,
  preferLnurlForInternalHandles,
  lnAddressHostname,
}: ParseDestinationParams): Promise<ParseDestinationResult> => {
  const destination = rawInput.trim()
  const parsedDestination = parsePaymentDestination({
    destination,
    network: bitcoinNetwork as NetworkGaloyClient,
    lnAddressDomains: lnurlDomains,
    inputSource,
    displayCurrency,
    preferLnurlForInternalHandles,
  })

  if (parsedDestination.paymentType === MerchantPaymentType) {
    const { merchants } = parsedDestination
    const [merchant] = merchants

    if (merchants.length > 1) {
      return {
        valid: true,
        destinationDirection: DestinationDirection.Send,
        validDestination: {
          paymentType: MerchantPaymentType,
          merchants,
        },
      } as const
    }

    if (merchant) {
      return resolveLnurlDestination({
        parsedLnurlDestination: merchantChoiceToLnurlDestination(merchant),
        lnurlDomains,
        accountDefaultWalletQuery,
        myWalletIds,
        lnAddressHostname,
      })
    }

    // Defensive only: when paymentType is Merchant, blink-client returns merchant values.
    return {
      valid: false,
      invalidReason: InvalidDestinationReason.UnknownDestination,
      invalidPaymentDestination: parsedDestination,
    } as const
  }

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
        lnAddressHostname,
      })
    }
    case PaymentType.Lightning: {
      return resolveLightningDestination(parsedDestination)
    }
    case PaymentType.Onchain: {
      // BIP-21 unified URIs carrying a lightning=LNURL param end up here because
      // parsePaymentDestination only resolves bolt11 lightning params. Prefer the
      // lightning option and keep the onchain address as fallback.
      const lnurl = getLnurlFromUnifiedUri(destination)
      if (lnurl) {
        try {
          const lnurlDestination = await resolveLnurlDestination({
            parsedLnurlDestination: {
              paymentType: PaymentType.Lnurl,
              valid: true,
              lnurl,
              isMerchant: false,
            },
            lnurlDomains,
            accountDefaultWalletQuery,
            myWalletIds,
            lnAddressHostname,
          })
          if (lnurlDestination.valid) {
            return lnurlDestination
          }
        } catch {
          // fall back to the onchain destination on any resolution failure
        }
      }
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
