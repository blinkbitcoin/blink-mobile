import React from "react"
import { it } from "@jest/globals"
import { Alert } from "react-native"
import type { ReactTestInstance } from "react-test-renderer"
import { render, waitFor } from "@testing-library/react-native"

import { injectJs } from "react-native-webln"

import { WebViewScreen } from "@app/screens/webview/webview"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { ContextForScreen } from "./helper"

type TestRoute = {
  key: string
  name: "webView"
  params: RootStackParamList["webView"]
}

const mockInjectJavaScript = jest.fn()

jest.mock("react-native-webview", () => {
  const ReactActual = jest.requireActual<typeof React>("react")
  const { View } = jest.requireActual("react-native")

  const MockWebView = ReactActual.forwardRef<unknown, React.ComponentProps<typeof View>>(
    (props, ref) => {
      ReactActual.useImperativeHandle(ref, () => ({
        injectJavaScript: mockInjectJavaScript,
        goBack: jest.fn(),
      }))
      return <View {...props} testID="webview" />
    },
  )
  MockWebView.displayName = "WebView"

  return {
    WebView: MockWebView,
  }
})

const mockWeblnHandler = jest.fn()

jest.mock("react-native-webln", () => ({
  injectJs: jest.fn(() => "webln-bridge-js"),
  onMessageHandler: jest.fn(() => mockWeblnHandler),
}))

jest.mock("@app/utils/external", () => ({
  openExternalUrl: jest.fn(),
}))

// The test context pins the Main galoy instance:
// kycUrl = https://kyc.blink.sv, fiatUrl = https://fiat.blink.sv
const FIAT_URL = "https://fiat.blink.sv?accountId=test"
const KYC_URL = "https://kyc.blink.sv/webflow?token=test&lang=en"

const mockRoute: TestRoute = {
  key: "webView",
  name: "webView" as const,
  params: {
    url: FIAT_URL,
    initialTitle: "Test Page",
  },
}

const mockRouteWithHeaderTitle: TestRoute = {
  key: "webView",
  name: "webView" as const,
  params: {
    url: KYC_URL,
    headerTitle: "Identity Verification",
  },
}

const mockRouteForMediaCapture: TestRoute = {
  key: "webView",
  name: "webView" as const,
  params: {
    url: "https://kyc.blink.sv/webflow?token=test&idDocType=ID_CARD",
    headerTitle: "Card ID Verification",
  },
}

const renderScreen = (route: TestRoute) =>
  render(
    <ContextForScreen>
      <WebViewScreen route={route} />
    </ContextForScreen>,
  )

const getWebView = async (route: TestRoute) => {
  const { getByTestId } = renderScreen(route)
  await waitFor(() => expect(getByTestId("webview")).toBeTruthy())
  return getByTestId("webview")
}

const simulateLoad = (webViewInstance: ReactTestInstance, url: string) => {
  webViewInstance.props.onLoadStart()
  webViewInstance.props.onLoadProgress({ nativeEvent: { progress: 0.8, url } })
}

describe("WebViewScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("allowsInlineMediaPlayback property", () => {
    it("should have allowsInlineMediaPlayback enabled on iOS", async () => {
      jest.doMock("@app/utils/helper", () => ({
        ...jest.requireActual("@app/utils/helper"),
        isIos: true,
      }))

      const webViewInstance = await getWebView(mockRoute)
      expect(webViewInstance.props.allowsInlineMediaPlayback).toBe(true)
    })

    it("should have allowsInlineMediaPlayback enabled on Android", async () => {
      jest.doMock("@app/utils/helper", () => ({
        ...jest.requireActual("@app/utils/helper"),
        isIos: false,
      }))

      const webViewInstance = await getWebView(mockRoute)
      expect(webViewInstance.props.allowsInlineMediaPlayback).toBe(true)
    })
  })

  describe("WebView with media playback", () => {
    it("should render WebView with allowsInlineMediaPlayback on iOS", async () => {
      jest.doMock("@app/utils/helper", () => ({
        ...jest.requireActual("@app/utils/helper"),
        isIos: true,
      }))

      const webViewInstance = await getWebView(mockRouteWithHeaderTitle)
      expect(webViewInstance.props.allowsInlineMediaPlayback).toBe(true)
      expect(webViewInstance.props.source.uri).toContain("kyc.blink.sv")
    })

    it("should render WebView with allowsInlineMediaPlayback on Android", async () => {
      jest.doMock("@app/utils/helper", () => ({
        ...jest.requireActual("@app/utils/helper"),
        isIos: false,
      }))

      const webViewInstance = await getWebView(mockRouteWithHeaderTitle)
      expect(webViewInstance.props.allowsInlineMediaPlayback).toBe(true)
      expect(webViewInstance.props.source.uri).toContain("kyc.blink.sv")
    })
  })

  describe("WebView rendering", () => {
    it("should render WebView with correct URL", async () => {
      const webViewInstance = await getWebView(mockRoute)
      expect(webViewInstance.props.source.uri).toBe(FIAT_URL)
    })

    it("should render WebView with custom header title", async () => {
      const customRoute = {
        ...mockRoute,
        params: {
          ...mockRoute.params,
          headerTitle: "Custom Title",
        },
      }

      const webViewInstance = await getWebView(customRoute)
      expect(webViewInstance).toBeTruthy()
    })
  })

  describe("iOS camera overlay for media capture", () => {
    it("should enable inline media playback for iOS camera overlay", async () => {
      jest.doMock("@app/utils/helper", () => ({
        ...jest.requireActual("@app/utils/helper"),
        isIos: true,
      }))

      const webViewInstance = await getWebView(mockRouteForMediaCapture)
      expect(webViewInstance.props.allowsInlineMediaPlayback).toBe(true)
    })
  })

  describe("entry allowlist", () => {
    it("refuses an off-instance entry URL without mounting the WebView", async () => {
      const alertSpy = jest.spyOn(Alert, "alert")

      const { queryByTestId } = renderScreen({
        ...mockRoute,
        params: { url: "https://evil.example/phishing" },
      })

      await waitFor(() => expect(alertSpy).toHaveBeenCalled())
      expect(queryByTestId("webview")).toBeNull()

      const buttons = alertSpy.mock.calls[0][2]
      expect(buttons).toHaveLength(1)
      expect(typeof buttons?.[0]?.onPress).toBe("function")
    })

    it("refuses unparseable entry URLs", async () => {
      const alertSpy = jest.spyOn(Alert, "alert")

      const { queryByTestId } = renderScreen({
        ...mockRoute,
        params: { url: "about:blank" },
      })

      await waitFor(() => expect(alertSpy).toHaveBeenCalled())
      expect(queryByTestId("webview")).toBeNull()
    })

    it("allows an arbitrary URL only with the developer-screen escape hatch", async () => {
      const webViewInstance = await getWebView({
        ...mockRoute,
        params: { url: "http://localhost:3000/dev", allowArbitraryUrl: true },
      })
      expect(webViewInstance.props.source.uri).toBe("http://localhost:3000/dev")
      // http entry widens the native scheme filter for that session only
      expect(webViewInstance.props.originWhitelist).toEqual(["https://*", "http://*"])
    })
  })

  describe("WebLN bridge gating", () => {
    it("injects the bridge on the fiat origin", async () => {
      const webViewInstance = await getWebView(mockRoute)

      simulateLoad(webViewInstance, "https://fiat.blink.sv/checkout?step=2")

      expect(injectJs).toHaveBeenCalledTimes(1)
      expect(mockInjectJavaScript).toHaveBeenCalledWith("webln-bridge-js")
    })

    it("does not inject the bridge after navigating off-origin", async () => {
      const webViewInstance = await getWebView(mockRoute)

      simulateLoad(webViewInstance, "https://fiat.blink.sv/checkout")
      expect(injectJs).toHaveBeenCalledTimes(1)

      simulateLoad(webViewInstance, "https://payment-partner.example/redirect")
      expect(injectJs).toHaveBeenCalledTimes(1) // unchanged: theme only, no bridge
    })

    it("does not inject the bridge on the KYC origin", async () => {
      const webViewInstance = await getWebView(mockRouteWithHeaderTitle)

      simulateLoad(webViewInstance, "https://kyc.blink.sv/webflow?token=test")

      expect(injectJs).not.toHaveBeenCalled()
      expect(mockInjectJavaScript).toHaveBeenCalled() // theme js still injected
    })

    it("injects the bridge on the entry origin under allowArbitraryUrl", async () => {
      const webViewInstance = await getWebView({
        ...mockRoute,
        params: { url: "http://localhost:3000/dev", allowArbitraryUrl: true },
      })

      simulateLoad(webViewInstance, "http://localhost:3000/webln-test")

      expect(injectJs).toHaveBeenCalledTimes(1)
    })
  })

  describe("message gating", () => {
    it("drops messages from non-bridge origins", async () => {
      const webViewInstance = await getWebView(mockRoute)

      webViewInstance.props.onMessage({
        nativeEvent: { url: "https://evil.example", data: "{}" },
      })
      expect(mockWeblnHandler).not.toHaveBeenCalled()

      webViewInstance.props.onMessage({
        nativeEvent: { url: "https://kyc.blink.sv/webflow", data: "{}" },
      })
      expect(mockWeblnHandler).not.toHaveBeenCalled() // kyc is not a bridge origin

      webViewInstance.props.onMessage({
        nativeEvent: { url: "https://fiat.blink.sv/checkout", data: "{}" },
      })
      expect(mockWeblnHandler).toHaveBeenCalledTimes(1)
    })
  })

  describe("hardening props", () => {
    it("restricts navigation to https and disables multiple windows", async () => {
      const webViewInstance = await getWebView(mockRoute)

      expect(webViewInstance.props.originWhitelist).toEqual(["https://*"])
      expect(webViewInstance.props.setSupportMultipleWindows).toBe(false)
      expect(typeof webViewInstance.props.onOpenWindow).toBe("function")
    })

    it("sends window.open targets to the external browser only when https", async () => {
      const { openExternalUrl } = jest.requireMock("@app/utils/external")
      const webViewInstance = await getWebView(mockRoute)

      webViewInstance.props.onOpenWindow({
        nativeEvent: { targetUrl: "https://help.example/faq" },
      })
      expect(openExternalUrl).toHaveBeenCalledWith("https://help.example/faq")

      webViewInstance.props.onOpenWindow({
        nativeEvent: { targetUrl: "javascript:void(0)" }, // eslint-disable-line no-script-url
      })
      expect(openExternalUrl).toHaveBeenCalledTimes(1)
    })
  })
})
