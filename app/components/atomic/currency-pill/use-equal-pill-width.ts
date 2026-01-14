import { useEffect, useState } from "react"
import { LayoutChangeEvent } from "react-native"
import rnTextSize from "react-native-text-size-latest"

import type { WalletCurrency } from "@app/graphql/generated"
import {
  CURRENCY_PILL_BORDER_WIDTH,
  CURRENCY_PILL_PADDING_HORIZONTAL,
  CURRENCY_PILL_TEXT_STYLE,
} from "./currency-pill"

type PillKey = typeof BTC | typeof USD
type UseEqualPillWidthOptions = {
  labels?: Partial<Record<PillKey, string>>
}

const BTC: WalletCurrency = "BTC"
const USD: WalletCurrency = "USD"

export const useEqualPillWidth = (options?: UseEqualPillWidthOptions) => {
  const labels = options?.labels
  const btcLabel = labels?.[BTC] ?? ""
  const usdLabel = labels?.[USD] ?? ""
  const [pillWidths, setPillWidths] = useState<Partial<Record<PillKey, number>>>({})
  const [measuredWidth, setMeasuredWidth] = useState(0)
  const btcWidth = pillWidths[BTC] ?? 0
  const usdWidth = pillWidths[USD] ?? 0
  const maxWidth = btcWidth > 0 && usdWidth > 0 ? Math.max(btcWidth, usdWidth) : 0

  useEffect(() => {
    let isMounted = true
    const labelValues = [btcLabel, usdLabel].filter(Boolean)

    if (!labelValues.length) {
      setMeasuredWidth(0)
      return
    }

    const measureLabels = async () => {
      try {
        const sizes = await Promise.all(
          labelValues.map((text) =>
            rnTextSize.measure({
              text,
              ...CURRENCY_PILL_TEXT_STYLE,
              usePreciseWidth: true,
              allowFontScaling: true,
            }),
          ),
        )
        const maxTextWidth = Math.max(...sizes.map((size) => size.width), 0)
        const totalWidth =
          maxTextWidth +
          CURRENCY_PILL_PADDING_HORIZONTAL * 2 +
          CURRENCY_PILL_BORDER_WIDTH * 2
        if (isMounted) setMeasuredWidth(totalWidth)
      } catch {
        if (isMounted) setMeasuredWidth(0)
      }
    }

    measureLabels()

    return () => {
      isMounted = false
    }
  }, [btcLabel, usdLabel])

  const minWidth = Math.max(maxWidth, measuredWidth)
  const widthStyle = minWidth ? { minWidth } : undefined

  const onPillLayout = (key: PillKey) => (event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout
    setPillWidths((prev) => (prev[key] === width ? prev : { ...prev, [key]: width }))
  }

  return { widthStyle, onPillLayout }
}
