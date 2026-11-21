import { useCallback } from "react"
import { Share } from "react-native"

import { MessageIcon, useNotifications } from "@app/components/notifications"
import { cancelPendingClipboardClear } from "@app/hooks/use-clipboard"
import { useI18nContext } from "@app/i18n/i18n-react"
import { TranslationFunctions } from "@app/i18n/i18n-types"
import { reportError } from "@app/utils/error-logging"
import { toastShow } from "@app/utils/toast"
import Clipboard from "@react-native-clipboard/clipboard"

import { Invoice, InvoiceType } from "../payment/index.types"

const toastMessageByType: Record<InvoiceType, (t: TranslationFunctions) => string> = {
  [Invoice.OnChain]: (t) => t.ReceiveScreen.copyClipboardBitcoin(),
  [Invoice.PayCode]: (t) => t.ReceiveScreen.copyClipboardPaycode(),
  [Invoice.Lightning]: (t) => t.ReceiveScreen.copyClipboard(),
}

type PaymentActionsInput = {
  copyableContent: string | undefined
  invoiceType: InvoiceType
}

export const usePaymentActions = ({
  copyableContent,
  invoiceType,
}: PaymentActionsInput) => {
  const { LL } = useI18nContext()
  const { notifyModal } = useNotifications()

  const copyToClipboard = useCallback(() => {
    if (!copyableContent) return

    cancelPendingClipboardClear()
    Clipboard.setString(copyableContent)
    toastShow({
      message: toastMessageByType[invoiceType],
      LL,
      type: "success",
    })
  }, [copyableContent, invoiceType, LL])

  const share = useCallback(async () => {
    if (!copyableContent) return
    try {
      await Share.share({ message: copyableContent })
    } catch (err) {
      if (err instanceof Error) {
        reportError("payment-actions", err)
        notifyModal({
          icon: MessageIcon.Alert,
          title: LL.Messages.shareFailedTitle(),
          text: LL.Messages.shareCopyFailedBody(),
          primaryButtonTitle: LL.Messages.copy(),
          primaryButtonAction: copyToClipboard,
        })
      }
    }
  }, [copyableContent, copyToClipboard, notifyModal, LL])

  return { copyToClipboard, share }
}
