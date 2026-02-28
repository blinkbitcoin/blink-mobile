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
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => () => clearTimeout(timerRef.current), [])

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
        timerRef.current = setTimeout(() => Clipboard.setString(""), clearAfterMs)
      }
    },
    [LL, clearAfterMs],
  )

  return { copyToClipboard }
}
