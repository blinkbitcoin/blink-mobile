import * as React from "react"
import { Alert, TouchableOpacity } from "react-native"
import { injectJs, onMessageHandler } from "react-native-webln"
import { WebView, WebViewMessageEvent, WebViewNavigation } from "react-native-webview"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { headerLeftNoGlass } from "@app/components/header-no-glass"
import { useAppConfig } from "@app/hooks/use-app-config"
import { useI18nContext } from "@app/i18n/i18n-react"
import { openExternalUrl } from "@app/utils/external"
import { logError } from "@app/utils/log-error"
import { isAllowedOrigin, originOf, originsFromUrls } from "@app/utils/webview-origin"
import { RouteProp, useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { makeStyles, useTheme } from "@rn-vui/themed"

import { Screen } from "../../components/screen"
import { RootStackParamList } from "../../navigation/stack-param-lists"
import {
  WebViewOpenWindowEvent,
  WebViewProgressEvent,
} from "react-native-webview/lib/WebViewTypes"

type WebViewDebugScreenRouteProp = RouteProp<RootStackParamList, "webView">

type Props = {
  route: WebViewDebugScreenRouteProp
}

export const WebViewScreen: React.FC<Props> = ({ route }) => {
  const styles = useStyles()

  const { navigate } =
    useNavigation<NativeStackNavigationProp<RootStackParamList, "Primary">>()
  const { url, initialTitle, headerTitle, allowArbitraryUrl } = route.params
  const { LL } = useI18nContext()

  const {
    appConfig: {
      galoyInstance: { kycUrl, fiatUrl },
    },
  } = useAppConfig()

  const webview = React.useRef<WebView | null>(null)
  // Not state: this guards a native side effect, is read and written inside the
  // same event callback, and must be atomic across events within one render.
  const jsInjected = React.useRef(false)

  const navigation = useNavigation()
  const [canGoBack, setCanGoBack] = React.useState<boolean>(false)

  const {
    theme: { colors, mode },
  } = useTheme()

  // Only origins owned by the active Galoy instance may load in this WebView
  // (the developer screen's free-text entry bypasses this via allowArbitraryUrl).
  const entryOrigins = React.useMemo(
    () => originsFromUrls([kycUrl, fiatUrl]),
    [kycUrl, fiatUrl],
  )
  const entryAllowed = allowArbitraryUrl === true || isAllowedOrigin(url, entryOrigins)

  // The WebLN bridge (window.webln -> sendPayment) is only for the fiat
  // buy/sell pages; KYC never needs it. Under allowArbitraryUrl the entry
  // origin doubles as the bridge origin so WebLN stays testable from the
  // developer screen.
  const bridgeOrigins = React.useMemo(
    () => originsFromUrls(allowArbitraryUrl ? [url] : [fiatUrl]),
    [allowArbitraryUrl, url, fiatUrl],
  )

  // Only a flow that started on a bridge origin can lose the bridge by hopping
  // off it; KYC never had one, so its loads must not raise a breadcrumb.
  const entryIsBridgeOrigin = isAllowedOrigin(url, bridgeOrigins)

  // https-only navigation, except when the entry itself is http (Local
  // instance / developer screen) — the scheme filter is enforced natively.
  const originWhitelist = React.useMemo(
    () =>
      originOf(url)?.startsWith("http:") ? ["https://*", "http://*"] : ["https://*"],
    [url],
  )

  const handleBackPress = React.useCallback(() => {
    if (webview.current && canGoBack) {
      webview.current.goBack()
      return
    }

    navigation.goBack()
  }, [canGoBack, navigation])

  React.useEffect(() => {
    if (headerTitle) {
      navigation.setOptions({ title: headerTitle })
      return
    }

    if (!initialTitle) return
    navigation.setOptions({ title: initialTitle })
  }, [navigation, initialTitle, headerTitle])

  React.useEffect(() => {
    navigation.setOptions({
      ...headerLeftNoGlass(() => (
        <TouchableOpacity style={styles.iconContainer} onPress={handleBackPress}>
          <GaloyIcon name="caret-left" size={20} color={colors.black} />
        </TouchableOpacity>
      )),
    })
  }, [navigation, handleBackPress, LL, styles.iconContainer, colors.black])

  React.useEffect(() => {
    if (entryAllowed) return
    // The user only ever sees a generic error, so record which origin was
    // refused — a misconfigured instance and a genuine block look identical.
    logError({
      scope: "webview",
      error: `refused entry URL (${originOf(url) ?? "unparseable"}), allowed: ${
        entryOrigins.join(", ") || "none"
      }`,
      expected: true,
      dedupKey: "webview-entry-refused",
    })
    Alert.alert(LL.common.error(), LL.GaloyAddressScreen.somethingWentWrong(), [
      { text: LL.common.ok(), onPress: () => navigation.goBack() },
    ])
  }, [entryAllowed, url, entryOrigins, LL, navigation])

  const handleWebViewNavigationStateChange = (newNavState: WebViewNavigation) => {
    setCanGoBack(newNavState.canGoBack)
    if (!headerTitle && newNavState.title) {
      navigation.setOptions({ title: newNavState.title })
    }
  }

  const injectThemeJs = () => {
    return `
      document.body.setAttribute("data-theme", "${mode}");
    `
  }

  const weblnHandler = onMessageHandler(webview as React.MutableRefObject<WebView>, {
    enable: async () => {
      /* Your implementation goes here */
    },
    getInfo: async () => {
      /* Your implementation goes here */
      return { node: { alias: "alias", color: "color", pubkey: "pubkey" } }
    },
    makeInvoice: async (_args) => {
      /* Your implementation goes here */
      return { paymentRequest: "paymentRequest" }
    },
    sendPayment: async (paymentRequestStr) => {
      navigate("sendBitcoinDestination", {
        payment: paymentRequestStr,
      })

      return { preimage: "preimage" }
      /* Your implementation goes here */
    },
    signMessage: async (_message) => {
      /* Your implementation goes here */
      return { signature: "signature", message: "message" }
    },
    verifyMessage: async (_signature, _message) => {
      /* Your implementation goes here */
    },
    keysend: async (_args) => {
      /* Your implementation goes here */
      return { preimage: "preimage" }
    },

    // Non-WebLN
    // Called when an a-tag containing a `lightning:` uri is found on a page
    // foundInvoice: async (paymentRequestStr) => {
    //   /* Your implementation goes here */
    // },
  })

  if (!entryAllowed) {
    return <Screen />
  }

  return (
    <Screen>
      <WebView
        ref={webview}
        source={{ uri: url }}
        originWhitelist={originWhitelist}
        // Load-bearing, do not set to false: on Android the open-window event is
        // dispatched only from RNCWebChromeClient.onCreateWindow, which the
        // platform calls only while multiple windows are supported. With false
        // the handler below is dead code there and window.open / target=_blank
        // navigates this trusted WebView in place instead — the opposite of the
        // intent. react-native-webview drops the popup itself once the handler
        // is registered, so nothing opens in-app either way.
        setSupportMultipleWindows={true}
        onOpenWindow={(e: WebViewOpenWindowEvent) => {
          // window.open / target=_blank never spawns a second in-app view:
          // https targets go to the system browser, everything else is dropped.
          const target = e.nativeEvent.targetUrl
          if (originOf(target)?.startsWith("https:")) {
            openExternalUrl(target)
            return
          }
          // Dropping is silent to the page, so leave a breadcrumb: a partner
          // flow that stalls on a swallowed popup is otherwise undiagnosable.
          logError({
            scope: "webview",
            error: `dropped non-https window.open target (${originOf(target) ?? "unparseable"})`,
            expected: true,
            dedupKey: "webview-window-open-dropped",
          })
        }}
        onLoadStart={() => {
          jsInjected.current = false
        }}
        onLoadProgress={(e: WebViewProgressEvent) => {
          if (jsInjected.current || e.nativeEvent.progress <= 0.75) return
          if (!webview.current) {
            Alert.alert("Error", "Webview not ready")
            return
          }
          // Latch before injecting, and in a ref rather than state: two progress
          // callbacks can arrive before React re-renders, and a state guard lets
          // both through — double-injecting the WebLN shim registers duplicate
          // listeners and pollers, so one sendPayment navigates twice.
          jsInjected.current = true
          webview.current.injectJavaScript(injectThemeJs())
          // The WebLN bridge is decided per load, against the URL of the
          // document actually loading, so a cross-origin redirect never
          // carries the bridge with it.
          if (isAllowedOrigin(e.nativeEvent.url, bridgeOrigins)) {
            webview.current.injectJavaScript(injectJs())
            return
          }
          // Withholding the bridge mid-flow is invisible to the user: the page
          // just never gets window.webln and the payment silently never starts.
          if (entryIsBridgeOrigin) {
            logError({
              scope: "webview",
              error: `WebLN bridge withheld: ${
                originOf(e.nativeEvent.url) ?? "unparseable"
              } is not a bridge origin`,
              expected: true,
              dedupKey: "webview-webln-bridge-withheld",
            })
          }
        }}
        onNavigationStateChange={handleWebViewNavigationStateChange}
        onMessage={(event: WebViewMessageEvent) => {
          // Pages can reach window.ReactNativeWebView.postMessage without the
          // injected shim, so the injection gate alone is not a boundary —
          // drop any message that does not come from a bridge origin.
          // Note this is the TOP-FRAME url: a third-party iframe embedded by a
          // bridge origin passes the check. Accepted for now (the bridge origin
          // is ours and controls what it embeds); frame-level identity would
          // need a nonce handshake through the injected shim.
          if (!isAllowedOrigin(event.nativeEvent.url, bridgeOrigins)) return
          weblnHandler(event)
        }}
        style={styles.full}
        allowsInlineMediaPlayback
      />
    </Screen>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  full: { width: "100%", height: "100%", flex: 1, backgroundColor: colors.transparent },
  iconContainer: {
    // native-stack wraps headerLeft in react-native-screens' ScreenStackHeaderLeftView,
    // which already applies the standard leading inset (both iOS bar-button items and
    // Android). An extra marginLeft stacks on top and pushes the glyph ~10px right, so
    // no margin here. (The old JS stack had no such inset, hence the previous marginLeft:10.)
  },
}))
