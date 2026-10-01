import {
  type BreezSdkInterface,
  type FiatCurrency,
  type Rate,
} from "@breeztech/breez-sdk-spark-react-native"

/**
 * The SDK's own fiat feed, which is what lets a self-custodial account price itself
 * without the Blink backend.
 *
 * `Rate.value` is the price of one BTC denominated in `Rate.coin`. The bindings only
 * call it "denominator in an exchange rate"; the direction is settled by the SDK's own
 * cross-chain code, which looks "USD" up in this feed and treats the result as the
 * BTC/USD rate ("Cross-chain: BTC/USD rate not found in feed").
 *
 * Both calls are served by `CachedFiatService`, whose cache is an in-memory map with a
 * TTL. It therefore answers offline within a session, but a cold start has nothing: the
 * map is rebuilt empty on every process launch. That is why the app persists what it
 * reads rather than relying on the SDK's cache.
 */

const FIAT_TIMEOUT_MS = 10_000

const withTimeout = async <T>(run: (signal: AbortSignal) => Promise<T>): Promise<T> => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FIAT_TIMEOUT_MS)
  try {
    return await run(controller.signal)
  } finally {
    clearTimeout(timer)
  }
}

export const listFiatRates = (sdk: BreezSdkInterface): Promise<Rate[]> =>
  withTimeout(async (signal) => (await sdk.listFiatRates({ signal })).rates)

export const listFiatCurrencies = (sdk: BreezSdkInterface): Promise<FiatCurrency[]> =>
  withTimeout(async (signal) => (await sdk.listFiatCurrencies({ signal })).currencies)
