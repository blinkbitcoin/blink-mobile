import * as React from "react"

import { type RealtimePriceQuery, useRealtimePriceQuery } from "@app/graphql/generated"
import { SATS_PER_BTC } from "@app/hooks/use-price-conversion"

import { type AgreementQuote } from "./investment-agreement"

type RealtimePrice = NonNullable<
  NonNullable<RealtimePriceQuery["me"]>["defaultAccount"]
>["realtimePrice"]

/** Both prices are quoted in the account's display currency, so their ratio is the
 *  dollar price whatever currency the investor reads amounts in. */
const toUsdCentsPerBtc = ({ btcSatPrice, usdCentPrice }: RealtimePrice): number => {
  const displayPerSat = btcSatPrice.base / 10 ** btcSatPrice.offset
  const displayPerUsdCent = usdCentPrice.base / 10 ** usdCentPrice.offset
  return Math.round((displayPerSat / displayPerUsdCent) * SATS_PER_BTC)
}

/**
 * The quote the agreement is minted at, asked of the network as the signing step opens
 * and never read from the cache: a price persisted from an earlier session can be hours
 * old, and the document would bind the signer to it as the current rate. The price the
 * app keeps polling lands here too, so a long stay on the step still holds a recent quote,
 * and `refresh` asks again when the latest one has gone stale.
 */
export const useAgreementQuote = (): {
  quote: AgreementQuote | null
  refresh: () => void
} => {
  const { data, refetch } = useRealtimePriceQuery({ fetchPolicy: "network-only" })
  const price = data?.me?.defaultAccount?.realtimePrice
  const [quote, setQuote] = React.useState<AgreementQuote | null>(null)

  React.useEffect(() => {
    if (!price) return
    setQuote({
      usdCentsPerBtc: toUsdCentsPerBtc(price),
      quotedAt: new Date(price.timestamp * 1000),
      receivedAt: new Date(),
    })
  }, [price])

  /** A refetch that fails leaves the stale quote standing, which the next mint refuses
   *  again; the failure itself is reported by the client's own error handling. */
  const refresh = React.useCallback(() => {
    refetch().catch(() => undefined)
  }, [refetch])

  return { quote, refresh }
}
