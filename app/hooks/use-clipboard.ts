import { useCallback } from "react"
import Clipboard from "@react-native-clipboard/clipboard"

import { toastShow } from "@app/utils/toast"
import { useI18nContext } from "@app/i18n/i18n-react"

type CopyToClipboardParams = {
  content: string
  message?: string
}

// One shared pending clear across all hook instances, deliberately surviving
// unmount: clearAfterMs exists so secrets (seed phrase, recovery bundle)
// don't linger in the clipboard, and users typically navigate away right
// after copying. The clipboard is a single global slot, so any newer copy
// makes an older pending clear obsolete; keeping the timer per-instance would
// let a departed screen wipe content copied later elsewhere. Direct callers
// of Clipboard.setString must cancel the timer first. Checking the current
// clipboard content before clearing also protects writes made outside the app.
let pendingClearTimer: ReturnType<typeof setTimeout> | undefined
let pendingClearGeneration = 0

/** Cancels a scheduled clipboard wipe. Call before any Clipboard.setString
 * that bypasses copyToClipboard, so a clear armed by an earlier secret copy
 * cannot wipe the newer content. */
export const cancelPendingClipboardClear = (): void => {
  pendingClearGeneration += 1
  clearTimeout(pendingClearTimer)
  pendingClearTimer = undefined
}

const clearClipboardIfCurrent = async (
  content: string,
  generation: number,
): Promise<void> => {
  const current = await Clipboard.getString()
  if (generation === pendingClearGeneration && current === content) {
    Clipboard.setString("")
  }
}

export const useClipboard = (clearAfterMs?: number) => {
  const { LL } = useI18nContext()

  const copyToClipboard = useCallback(
    ({ content, message }: CopyToClipboardParams): void => {
      cancelPendingClipboardClear()
      Clipboard.setString(content)
      toastShow({
        type: "success",
        message: message ?? LL.common.copied(),
        LL,
      })
      if (clearAfterMs) {
        const generation = pendingClearGeneration
        pendingClearTimer = setTimeout(() => {
          pendingClearTimer = undefined
          clearClipboardIfCurrent(content, generation).catch(() => {})
        }, clearAfterMs)
      }
    },
    [LL, clearAfterMs],
  )

  return { copyToClipboard }
}
