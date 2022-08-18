import { ServerError, ServerParseError } from "@apollo/client"
import { useApolloNetworkStatus } from "../../app"
import { ComponentType } from "../../types/jsx"
import { NetworkErrorCode } from "./network-error-code"
import { toastShow } from "@app/utils/toast"
import useLogout from "@app/hooks/use-logout"
import { translate } from "@app/utils/translate"

export const GlobalErrorToast: ComponentType = () => {
  const status = useApolloNetworkStatus()
  // use logout hook
  const { logout } = useLogout()

  // "prices" is a polled query.
  // filter this to not have the error message being showed
  // every 5 seconds or so in case of network disruption
  if (status.queryError?.operation?.operationName === "prices") {
    return null
  }

  const networkError = (status.queryError || status.mutationError)?.networkError as
    | ServerError
    | ServerParseError

  if (!networkError) {
    return null
  }

  if (networkError.statusCode >= 500) {
    // TODO translation
    toastShow({ message: translate("errors.network.server") })
  }

  if (networkError.statusCode >= 400 && networkError.statusCode < 500) {
    let errorCode = (networkError as ServerError).result?.errors?.[0]?.code

    if (!errorCode) {
      switch (networkError.statusCode) {
        case 401:
          errorCode = "INVALID_AUTHENTICATION"
          break
      }
    }

    switch (errorCode) {
      case NetworkErrorCode.InvalidAuthentication:
        toastShow({ message: translate("common.reauth"), _onHide: () => logout() })
        break

      default:
        // TODO translation
        toastShow({ message: translate("errors.network.request") })
        break
    }
  }

  if (networkError.message === "Network request failed") {
    // TODO translation
    toastShow({ message: translate("errors.network.connection") })
  }

  if (status.mutationError) {
    status.mutationError.networkError = null
  }

  if (status.queryError) {
    status.queryError.networkError = null
  }

  return null
}
