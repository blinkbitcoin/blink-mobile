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
// after copying. The clipboard is a single global slot, so ANY newer copy -
// from any screen - makes an older pending clear obsolete; keeping the timer
// per-instance would let a departed screen wipe content copied later
// elsewhere. The timer only writes to the clipboard, never to React state,
// so firing after unmount is safe.
let pendingClearTimer: ReturnType<typeof setTimeout> | undefined

export const useClipboard = (clearAfterMs?: number) => {
  const { LL } = useI18nContext()

  const copyToClipboard = useCallback(
    ({ content, message }: CopyToClipboardParams): void => {
      clearTimeout(pendingClearTimer)
      pendingClearTimer = undefined
      Clipboard.setString(content)
      toastShow({
        type: "success",
        message: message ?? LL.common.copied(),
        LL,
      })
      if (clearAfterMs) {
        pendingClearTimer = setTimeout(() => Clipboard.setString(""), clearAfterMs)
      }
    },
    [LL, clearAfterMs],
  )

  return { copyToClipboard }
}
