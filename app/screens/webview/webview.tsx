import * as React from "react"
import { Alert, TouchableOpacity } from "react-native"
import { injectJs, onMessageHandler } from "react-native-webln"
import { WebView, WebViewMessageEvent, WebViewNavigation } from "react-native-webview"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { headerLeftNoGlass } from "@app/components/header-no-glass"
import { useAppConfig } from "@app/hooks/use-app-config"
import { useI18nContext } from "@app/i18n/i18n-react"
import { openExternalUrl } from "@app/utils/external"
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
  const [jsInjected, setJsInjected] = React.useState(false)

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
    Alert.alert(LL.common.error(), LL.GaloyAddressScreen.somethingWentWrong(), [
      { text: LL.common.ok(), onPress: () => navigation.goBack() },
    ])
  }, [entryAllowed, LL, navigation])

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
        setSupportMultipleWindows={false}
        onOpenWindow={(e: WebViewOpenWindowEvent) => {
          // window.open / target=_blank never spawns a second in-app view:
          // https targets go to the system browser, everything else is dropped.
          const target = e.nativeEvent.targetUrl
          if (originOf(target)?.startsWith("https:")) {
            openExternalUrl(target)
          }
        }}
        onLoadStart={() => setJsInjected(false)}
        onLoadProgress={(e: WebViewProgressEvent) => {
          if (!jsInjected && e.nativeEvent.progress > 0.75) {
            if (webview.current) {
              webview.current.injectJavaScript(injectThemeJs())
              // The WebLN bridge is decided per load, against the URL of the
              // document actually loading, so a cross-origin redirect never
              // carries the bridge with it.
              if (isAllowedOrigin(e.nativeEvent.url, bridgeOrigins)) {
                webview.current.injectJavaScript(injectJs())
              }
              setJsInjected(true)
            } else Alert.alert("Error", "Webview not ready")
          }
        }}
        onNavigationStateChange={handleWebViewNavigationStateChange}
        onMessage={(event: WebViewMessageEvent) => {
          // Pages can reach window.ReactNativeWebView.postMessage without the
          // injected shim, so the injection gate alone is not a boundary —
          // drop any message that does not come from a bridge origin.
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
