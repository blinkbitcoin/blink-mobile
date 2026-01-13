import { useState } from "react"
import { LayoutChangeEvent } from "react-native"

import type { WalletCurrency } from "@app/graphql/generated"

const BTC: WalletCurrency = "BTC"
const USD: WalletCurrency = "USD"
type PillKey = typeof BTC | typeof USD

export const useEqualPillWidth = () => {
  const [pillWidths, setPillWidths] = useState<Partial<Record<PillKey, number>>>({})
  const btcWidth = pillWidths[BTC] ?? 0
  const usdWidth = pillWidths[USD] ?? 0
  const maxWidth = btcWidth > 0 && usdWidth > 0 ? Math.max(btcWidth, usdWidth) : 0
  const widthStyle = maxWidth ? { width: maxWidth } : undefined

  const onPillLayout = (key: PillKey) => (event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout
    setPillWidths((prev) => (prev[key] === width ? prev : { ...prev, [key]: width }))
  }

  return { widthStyle, onPillLayout }
}
