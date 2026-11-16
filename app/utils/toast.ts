import Toast from "react-native-toast-message"

import type { ToastType } from "@app/components/galoy-toast"
import { TranslationFunctions } from "@app/i18n/i18n-types"
import { i18nObject } from "@app/i18n/i18n-util"

import { logToastShown } from "./analytics"

export const REDACTED_TOAST_VALUE = "[redacted]"

/** The message is logged verbatim, so a value from the user's own data would leave the
 *  device with it. Blank values are skipped: replacing "" would splice the placeholder
 *  between every character. */
const redact = (message: string, privateValues: ReadonlyArray<string>): string =>
  privateValues
    .filter((value) => value.trim() !== "")
    .reduce(
      (redacted, value) => redacted.replaceAll(value, REDACTED_TOAST_VALUE),
      message,
    )

export const toastShow = ({
  message,
  LL,
  onHide,
  type = "error",
  autoHide,
  privateValues = [],
}: {
  message: ((translations: TranslationFunctions) => string) | string
  LL: TranslationFunctions
  onHide?: () => void
  type?: ToastType
  autoHide?: boolean
  /** Values from the user's own data that the message spells out, such as an account's
   *  address or username: the toast shows them, the analytics event gets a placeholder. */
  privateValues?: ReadonlyArray<string>
}): void => {
  const englishTranslation = i18nObject("en")
  const englishMessage =
    typeof message === "function" ? message(englishTranslation) : message
  const translatedMessage = typeof message === "function" ? message(LL) : message

  const toastTitle = {
    error: LL.common.error(),
    success: LL.common.success(),
    warning: LL.common.warning(),
  }

  logToastShown({
    message: redact(englishMessage, privateValues),
    type,
    isTranslated: translatedMessage !== englishMessage,
  })

  // FIXME: Toast might not be shown if there is a modal already,
  // like in the case of the quiz rewards questions
  //
  // a potential solution:
  // https://github.com/calintamas/react-native-toast-message/issues/164#issuecomment-803556361
  Toast.show({
    type,
    text1: toastTitle[type],
    text2: translatedMessage,
    position: "top",
    onHide,
    visibilityTime: 4000,
    autoHide,
  })
}
