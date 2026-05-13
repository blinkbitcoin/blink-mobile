import { useI18nContext } from "@app/i18n/i18n-react"

import { NwcConnectionCreateErrorCode } from "./nwc-service"

type TranslationFunctions = ReturnType<typeof useI18nContext>["LL"]

export const createNwcConnectionErrorMessage = (
  errorCode: NwcConnectionCreateErrorCode,
  LL: TranslationFunctions,
  fallbackMessage?: string,
) => {
  switch (errorCode) {
    case "DUPLICATE_CONNECTION":
      return LL.NostrWalletConnect.connectionAlreadyExists()
    case "NETWORK_ERROR":
      if (__DEV__ && fallbackMessage) return fallbackMessage
      return LL.NostrWalletConnect.connectionNetworkError()
    case "RELAY_UNREACHABLE":
      if (__DEV__ && fallbackMessage) return fallbackMessage
      return LL.NostrWalletConnect.connectionRelayUnreachable()
    case "UNSUPPORTED_PERMISSIONS":
      return LL.NostrWalletConnect.unsupportedNwcPermissions()
    case "UNKNOWN_ERROR":
      if (__DEV__ && fallbackMessage) return fallbackMessage
      return LL.NostrWalletConnect.connectionCreateFailed()
  }
}
