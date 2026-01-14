import { useEffect, useState } from "react"
import { LayoutChangeEvent } from "react-native"

import type { WalletCurrency } from "@app/graphql/generated"

type PillKey = typeof BTC | typeof USD
type UseEqualPillWidthOptions = {
  useCache?: boolean
}

const BTC: WalletCurrency = "BTC"
const USD: WalletCurrency = "USD"
const pillWidthCache = new Map<string, number>()

export const useEqualPillWidth = (options?: UseEqualPillWidthOptions) => {
  const useCache = options?.useCache ?? false
  const [pillWidths, setPillWidths] = useState<Partial<Record<PillKey, number>>>({})
  const [cachedWidth, setCachedWidth] = useState(
    useCache ? pillWidthCache.get("max") ?? 0 : 0,
  )
  const btcWidth = pillWidths[BTC] ?? 0
  const usdWidth = pillWidths[USD] ?? 0
  const maxWidth = btcWidth > 0 && usdWidth > 0 ? Math.max(btcWidth, usdWidth) : 0

  useEffect(() => {
    if (!useCache || !maxWidth || maxWidth <= (pillWidthCache.get("max") ?? 0)) return

    pillWidthCache.set("max", maxWidth)
    setCachedWidth(maxWidth)
  }, [maxWidth, useCache])

  const minWidth = useCache ? Math.max(maxWidth, cachedWidth) : maxWidth
  const widthStyle = minWidth ? { minWidth } : undefined

  const onPillLayout = (key: PillKey) => (event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout
    setPillWidths((prev) => (prev[key] === width ? prev : { ...prev, [key]: width }))
  }

  return { widthStyle, onPillLayout }
}
