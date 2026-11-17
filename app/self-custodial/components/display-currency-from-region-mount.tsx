import React from "react"

import { useDisplayCurrencyFromRegion } from "../hooks/use-display-currency-from-region"

/**
 * Root-level host: the account that needs a default is the one that has just been restored
 * or created, and the currency list it is matched against may only arrive later, which no
 * single screen stays mounted for.
 */
export const DisplayCurrencyFromRegionMount: React.FC = () => {
  useDisplayCurrencyFromRegion()
  return null
}
