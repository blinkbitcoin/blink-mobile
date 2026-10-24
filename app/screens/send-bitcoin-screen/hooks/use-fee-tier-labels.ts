import { useMemo } from "react"

import { useI18nContext } from "@app/i18n/i18n-react"

import { FeeTierOption } from "./fee-tiers.types"

/**
 * The one place a tier is named. The selector, the review row and the refund screen all
 * read from here, so a rename lands everywhere at once.
 */
export const useFeeTierLabels = (): Record<FeeTierOption, string> => {
  const { LL } = useI18nContext()

  return useMemo(
    () => ({
      [FeeTierOption.Fast]: LL.SendBitcoinScreen.fast(),
      [FeeTierOption.Medium]: LL.SendBitcoinScreen.medium(),
      [FeeTierOption.Slow]: LL.SendBitcoinScreen.slow(),
    }),
    [LL],
  )
}
