import { useEffect } from "react"

import { useCurrencyList } from "@app/hooks/use-currency-list"
import { usePersistentStateContext } from "@app/store/persistent-state"
import { resolveActiveSelfCustodialId } from "@app/store/persistent-state/active-self-custodial-account"
import {
  getSelfCustodialDisplayCurrency,
  withSelfCustodialDisplayCurrency,
} from "@app/store/persistent-state/self-custodial-display-currency"
import { detectDefaultCurrency } from "@app/utils/locale-detector"

/**
 * Gives an account that has never named a display currency the one its device's region
 * implies, so a restored wallet stops landing on dollars in a country that does not use
 * them. A custodial account is not covered: its preference lives on the server and always
 * holds a value, so it has no unanswered case to fill.
 *
 * The choice is written once rather than re-derived on every read. An unwritten default
 * would resolve again on each launch, so a cold currency list would show dollars and then
 * switch mid-session, and the settings row would read as already selected while refusing
 * the tap that would confirm it.
 *
 * The device's currency is honoured only when it can actually be priced: an unsupported
 * code leaves the price with no denominator, which is worse than dollars. The list now
 * comes from whichever source can answer — the Breez SDK for a self-custodial account,
 * the backend otherwise — so a launch with Blink down still resolves a region default.
 *
 * A launch that reaches neither writes nothing and leaves the account on dollars until
 * the next one. Restoring a wallet needs the network anyway, so a list is there on the
 * launch that matters; waiting a session beats freezing a guess.
 */
export const useDisplayCurrencyFromRegion = (): void => {
  const { persistentState, updateState } = usePersistentStateContext()

  const activeAccountId = resolveActiveSelfCustodialId(persistentState)
  const isDisplayCurrencyUnanswered =
    Boolean(activeAccountId) && !getSelfCustodialDisplayCurrency(persistentState)

  const { currencyList } = useCurrencyList()

  useEffect(() => {
    if (!isDisplayCurrencyUnanswered || !currencyList?.length) return

    const currencyFromRegion = detectDefaultCurrency(
      currencyList.map((currency) => currency.id),
    )
    if (!currencyFromRegion) return

    updateState(
      (prev) => prev && withSelfCustodialDisplayCurrency(prev, currencyFromRegion),
    )
  }, [isDisplayCurrencyUnanswered, currencyList, updateState])
}
