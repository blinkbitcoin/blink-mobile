import { useCallback } from "react"
import Clipboard from "@react-native-clipboard/clipboard"

import { toastShow } from "@app/utils/toast"
import { useI18nContext } from "@app/i18n/i18n-react"

type CopyToClipboardParams = {
  content: string
  message?: string
}

export const useClipboard = () => {
  const { LL } = useI18nContext()

  const copyToClipboard = useCallback(
    ({ content, message }: CopyToClipboardParams): void => {
      Clipboard.setString(content)
      toastShow({
        type: "success",
        message: message ?? LL.common.copied(),
        LL,
      })
    },
    [LL],
  )

  return { copyToClipboard }
}
