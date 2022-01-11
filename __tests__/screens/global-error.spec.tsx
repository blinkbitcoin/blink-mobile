import { MockedProvider } from "@apollo/client/testing"
import "@mocks/react-navigation-stack"
import "@mocks/react-native-push-notification"
import "@mocks/react-native-iphone-x-helper"
import { render } from "@testing-library/react-native"
import * as React from "react"
import { NetworkStatus } from "react-apollo-network-status"
import { UseApolloNetworkStatusOptions } from "react-apollo-network-status/dist/src/useApolloNetworkStatus"
import Toast from "react-native-root-toast"
import { useApolloNetworkStatus } from "../../app/app"
import { GlobalErrorToast } from "../../app/components/global-error"
import { NetworkErrorCode } from "../../app/components/global-error/network-error-code"
import * as toastShowModule from "../../app/utils/toast"

jest.mock("../../app/app")
jest.mock("react-native/Libraries/EventEmitter/NativeEventEmitter")
jest.mock("react-native-version-number", () => ({}))
jest.mock("@react-native-community/push-notification-ios", () => ({}))
jest.mock("react-native-walkthrough-tooltip", () => ({}))
jest.mock("react-native-fingerprint-scanner", () => ({}))
jest.mock("react-native-snap-carousel", () => ({}))
jest.mock("react-native-maps", () => ({}))
jest.mock("react-native-phone-number-input", () => ({}))
jest.mock("victory-native", () => ({}))
jest.mock("react-native-screen-brightness", () => ({}))
jest.mock("react-native-swiper", () => ({}))
jest.mock("react-native-qrcode-svg", () => ({}))
jest.mock("react-native-share", () => ({}))
jest.mock("react-native-gesture-handler", () => ({}))

describe("GlobalError tests", () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  const toastSpy = jest.spyOn(toastShowModule, "toastShow")

  const useApolloNetworkStatusMock = useApolloNetworkStatus as jest.MockedFunction<
    (options?: UseApolloNetworkStatusOptions) => NetworkStatus | unknown
  >

  function renderGlobalErrorToast(status: NetworkStatus | unknown) {
    useApolloNetworkStatusMock.mockReturnValue(status)
    const tree = render(
      <MockedProvider>
        <GlobalErrorToast />
      </MockedProvider>,
    ).toJSON()

    expect(tree).toBeNull()
  }

  it(`should not show a toast when status is from "prices" polled query`, () => {
    renderGlobalErrorToast({
      queryError: { operation: { operationName: "prices" } },
    })

    expect(toastSpy).toHaveBeenCalledTimes(0)
  })

  it(`should not show a toast when status doesn't contain a NetworkError`, () => {
    renderGlobalErrorToast({
      queryError: { mockField: "mock value" },
    })

    expect(toastSpy).toHaveBeenCalledTimes(0)
  })

  it(`should show a toast with "Server Error. Please try again later" when statusCode >= 500`, () => {
    renderGlobalErrorToast({
      queryError: { networkError: { statusCode: 500 } },
    })

    expect(toastSpy).toHaveBeenCalledTimes(1)
    expect(toastSpy).toHaveBeenCalledWith("Server Error. Please try again later")
  })

  it(`should show a toast with "Your session has expired. Please log in again." 
      when statusCode >= 400 and < 500; and errorCode is "INVALID_AUTHENTICATION"`, () => {
    renderGlobalErrorToast({
      queryError: {
        networkError: {
          statusCode: 400,
          result: { errors: [{ code: NetworkErrorCode.InvalidAuthentication }] },
        },
      },
    })

    expect(toastSpy).toHaveBeenCalledTimes(1)
    expect(toastSpy).toHaveBeenCalledWith(
      "Your session has expired. Please log in again.",
      {
        duration: Toast.durations.SHORT,
        onHidden: expect.any(Function),
      },
    )
  })

  it(`should show a toast with "Request issue.\nContact support if the problem persists" 
      when statusCode >= 400 and < 500; and errorCode is DIFFERENT FROM "INVALID_AUTHENTICATION"`, () => {
    renderGlobalErrorToast({
      queryError: { networkError: { statusCode: 400 } },
    })

    expect(toastSpy).toHaveBeenCalledTimes(1)
    expect(toastSpy).toHaveBeenCalledWith(
      "Request issue.\nContact support if the problem persists",
    )
  })

  it(`should show a toast with "Connection issue.\nVerify your internet connection" 
      when message is "Network request failed"`, () => {
    renderGlobalErrorToast({
      queryError: {
        networkError: { message: "Network request failed" },
      },
    })

    expect(toastSpy).toHaveBeenCalledTimes(1)
    expect(toastSpy).toHaveBeenCalledWith(
      "Connection issue.\nVerify your internet connection",
    )
  })
})
