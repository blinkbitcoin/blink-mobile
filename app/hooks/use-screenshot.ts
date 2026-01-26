import { useCallback, useState, type RefObject } from "react"
import type { View } from "react-native"
import Share from "react-native-share"
import { captureRef } from "react-native-view-shot"

const SCREENSHOT_DELAY_MS = 100

const delay = (ms: number): Promise<void> =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })

export const useScreenshot = (viewRef: RefObject<View>) => {
  const [isTakingScreenshot, setIsTakingScreenshot] = useState(false)

  const captureAndShare = useCallback(async () => {
    try {
      setIsTakingScreenshot(true)

      await delay(SCREENSHOT_DELAY_MS)

      const uri = await captureRef(viewRef, {
        format: "jpg",
        quality: 0.9,
      })

      await Share.open({
        url: uri,
        failOnCancel: false,
      })
    } catch {
      return
    } finally {
      setIsTakingScreenshot(false)
    }
  }, [viewRef])

  return { isTakingScreenshot, captureAndShare }
}
