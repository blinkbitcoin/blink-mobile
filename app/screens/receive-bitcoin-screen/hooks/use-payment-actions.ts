import { useCallback } from "react"
import { Alert, Share } from "react-native"

import { useI18nContext } from "@app/i18n/i18n-react"
import { TranslationFunctions } from "@app/i18n/i18n-types"
import { toastShow } from "@app/utils/toast"
import Clipboard from "@react-native-clipboard/clipboard"
import crashlytics from "@react-native-firebase/crashlytics"

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

  const copyToClipboard = useCallback(() => {
    if (!copyableContent) return

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
        crashlytics().recordError(err)
        Alert.alert(err.message)
      }
    }
  }, [copyableContent])

  return { copyToClipboard, share }
}
