import { useCallback, useEffect, useRef } from "react"
import Clipboard from "@react-native-clipboard/clipboard"

import { toastShow } from "@app/utils/toast"
import { useI18nContext } from "@app/i18n/i18n-react"

type CopyToClipboardParams = {
  content: string
  message?: string
}

export const useClipboard = (clearAfterMs?: number) => {
  const { LL } = useI18nContext()
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  // Content awaiting a timed clear; null once cleared or superseded
  const pendingContentRef = useRef<string | null>(null)

  const clearPendingContent = useCallback(async (): Promise<void> => {
    clearTimeout(timerRef.current)
    const content = pendingContentRef.current
    pendingContentRef.current = null
    if (!content) return
    // Only wipe if the clipboard still holds what we copied — the user may
    // have copied something else since
    const current = await Clipboard.getString()
    if (current === content) Clipboard.setString("")
  }, [])

  useEffect(() => {
    return () => {
      // Clear immediately rather than dropping the scheduled clear, so a
      // copied secret never outlives the screen that promised to clear it
      clearPendingContent().catch(() => {})
    }
  }, [clearPendingContent])

  const copyToClipboard = useCallback(
    ({ content, message }: CopyToClipboardParams): void => {
      clearTimeout(timerRef.current)
      Clipboard.setString(content)
      toastShow({
        type: "success",
        message: message ?? LL.common.copied(),
        LL,
      })
      if (clearAfterMs) {
        pendingContentRef.current = content
        timerRef.current = setTimeout(() => {
          clearPendingContent().catch(() => {})
        }, clearAfterMs)
      } else {
        pendingContentRef.current = null
      }
    },
    [LL, clearAfterMs, clearPendingContent],
  )

  return { copyToClipboard }
}
