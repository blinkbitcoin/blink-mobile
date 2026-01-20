import React from "react"
import { it } from "@jest/globals"
import { render, waitFor } from "@testing-library/react-native"

import { WebViewScreen } from "@app/screens/webview/webview"
import { ContextForScreen } from "./helper"

jest.mock("react-native-webview", () => {
  const { View } = jest.requireActual("react-native")

  const MockWebView = React.forwardRef<
    React.ComponentRef<typeof View>,
    React.ComponentProps<typeof View>
  >((props, ref) => {
    return <View ref={ref} {...props} testID="webview" />
  })
  MockWebView.displayName = "WebView"

  return {
    WebView: MockWebView,
  }
})

jest.mock("react-native-webln", () => ({
  injectJs: jest.fn(() => ""),
  onMessageHandler: jest.fn(() => jest.fn()),
}))

const mockRoute = {
  key: "webView",
  name: "webView" as const,
  params: {
    url: "https://example.com",
    initialTitle: "Test Page",
  },
}

const mockRouteWithHeaderTitle = {
  key: "webView",
  name: "webView" as const,
  params: {
    url: "https://verification.example.com/flow?token=test",
    headerTitle: "Identity Verification",
  },
}

const mockRouteForMediaCapture = {
  key: "webView",
  name: "webView" as const,
  params: {
    url: "https://kyc.example.com/webflow?token=test&idDocType=ID_CARD",
    headerTitle: "Card ID Verification",
  },
}

describe("WebViewScreen", () => {
  describe("allowsInlineMediaPlayback property", () => {
    it("should have allowsInlineMediaPlayback enabled on iOS", async () => {
      jest.doMock("@app/utils/helper", () => ({
        ...jest.requireActual("@app/utils/helper"),
        isIos: true,
      }))

      const { getByTestId } = render(
        <ContextForScreen>
          <WebViewScreen route={mockRoute} />
        </ContextForScreen>,
      )

      await waitFor(() => {
        const webViewInstance = getByTestId("webview")
        expect(webViewInstance).toBeTruthy()
        expect(webViewInstance.props.allowsInlineMediaPlayback).toBe(true)
      })
    })

    it("should have allowsInlineMediaPlayback enabled on Android", async () => {
      jest.doMock("@app/utils/helper", () => ({
        ...jest.requireActual("@app/utils/helper"),
        isIos: false,
      }))

      const { getByTestId } = render(
        <ContextForScreen>
          <WebViewScreen route={mockRoute} />
        </ContextForScreen>,
      )

      await waitFor(() => {
        const webViewInstance = getByTestId("webview")
        expect(webViewInstance).toBeTruthy()
        expect(webViewInstance.props.allowsInlineMediaPlayback).toBe(true)
      })
    })
  })

  describe("WebView with media playback", () => {
    it("should render WebView with allowsInlineMediaPlayback on iOS", async () => {
      jest.doMock("@app/utils/helper", () => ({
        ...jest.requireActual("@app/utils/helper"),
        isIos: true,
      }))

      const { getByTestId } = render(
        <ContextForScreen>
          <WebViewScreen route={mockRouteWithHeaderTitle} />
        </ContextForScreen>,
      )

      await waitFor(() => {
        const webViewInstance = getByTestId("webview")
        expect(webViewInstance).toBeTruthy()
        expect(webViewInstance.props.allowsInlineMediaPlayback).toBe(true)
        expect(webViewInstance.props.source.uri).toContain("verification.example.com")
      })
    })

    it("should render WebView with allowsInlineMediaPlayback on Android", async () => {
      jest.doMock("@app/utils/helper", () => ({
        ...jest.requireActual("@app/utils/helper"),
        isIos: false,
      }))

      const { getByTestId } = render(
        <ContextForScreen>
          <WebViewScreen route={mockRouteWithHeaderTitle} />
        </ContextForScreen>,
      )

      await waitFor(() => {
        const webViewInstance = getByTestId("webview")
        expect(webViewInstance).toBeTruthy()
        expect(webViewInstance.props.allowsInlineMediaPlayback).toBe(true)
        expect(webViewInstance.props.source.uri).toContain("verification.example.com")
      })
    })
  })

  describe("WebView rendering", () => {
    it("should render WebView with correct URL", async () => {
      const { getByTestId } = render(
        <ContextForScreen>
          <WebViewScreen route={mockRoute} />
        </ContextForScreen>,
      )

      await waitFor(() => {
        const webViewInstance = getByTestId("webview")
        expect(webViewInstance).toBeTruthy()
        expect(webViewInstance.props.source.uri).toBe("https://example.com")
      })
    })

    it("should render WebView with custom header title", async () => {
      const customRoute = {
        ...mockRoute,
        params: {
          ...mockRoute.params,
          headerTitle: "Custom Title",
        },
      }

      const { getByTestId } = render(
        <ContextForScreen>
          <WebViewScreen route={customRoute} />
        </ContextForScreen>,
      )

      await waitFor(() => {
        const webViewInstance = getByTestId("webview")
        expect(webViewInstance).toBeTruthy()
      })
    })
  })

  describe("iOS camera overlay for media capture", () => {
    it("should enable inline media playback for iOS camera overlay", async () => {
      jest.doMock("@app/utils/helper", () => ({
        ...jest.requireActual("@app/utils/helper"),
        isIos: true,
      }))

      const { getByTestId } = render(
        <ContextForScreen>
          <WebViewScreen route={mockRouteForMediaCapture} />
        </ContextForScreen>,
      )

      await waitFor(() => {
        const webViewInstance = getByTestId("webview")
        expect(webViewInstance).toBeTruthy()
        expect(webViewInstance.props.allowsInlineMediaPlayback).toBe(true)
      })
    })
  })
})
