import * as React from "react"
import { Alert, TouchableOpacity } from "react-native"
import { injectJs, onMessageHandler } from "react-native-webln"
import { WebView, WebViewNavigation } from "react-native-webview"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RouteProp, useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import { makeStyles, useTheme } from "@rneui/themed"

import { Screen } from "../../components/screen"
import { RootStackParamList } from "../../navigation/stack-param-lists"
import { WebViewProgressEvent } from "react-native-webview/lib/WebViewTypes"

type WebViewDebugScreenRouteProp = RouteProp<RootStackParamList, "webView">

type Props = {
  route: WebViewDebugScreenRouteProp
}

export const WebViewScreen: React.FC<Props> = ({ route }) => {
  const styles = useStyles()

  const { navigate } = useNavigation<StackNavigationProp<RootStackParamList, "Primary">>()
  const { url, initialTitle } = route.params
  const { LL } = useI18nContext()

  const webview = React.useRef<WebView | null>(null)
  const [jsInjected, setJsInjected] = React.useState(false)

  const navigation = useNavigation()
  const [canGoBack, setCanGoBack] = React.useState<boolean>(false)

  const {
    theme: { colors, mode },
  } = useTheme()

  const handleBackPress = React.useCallback(() => {
    if (webview.current && canGoBack) {
      webview.current.goBack()
      return
    }

    navigation.goBack()
  }, [canGoBack, navigation])

  React.useEffect(() => {
    if (!initialTitle) return
    navigation.setOptions({ title: initialTitle })
  }, [navigation, initialTitle])

  React.useEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity style={styles.iconContainer} onPress={handleBackPress}>
          <GaloyIcon name="caret-left" size={20} color={colors.black} />
        </TouchableOpacity>
      ),
    })
  }, [navigation, handleBackPress, LL, styles.iconContainer, colors.black])

  const handleWebViewNavigationStateChange = (newNavState: WebViewNavigation) => {
    setCanGoBack(newNavState.canGoBack)
    newNavState.title && navigation.setOptions({ title: newNavState.title })
  }

  const injectThemeJs = () => {
    return `
      document.body.setAttribute("data-theme", "${mode}");
    `
  }

  return (
    <Screen>
      <WebView
        ref={webview}
        source={{ uri: url }}
        onLoadStart={() => setJsInjected(false)}
        onLoadProgress={(e: WebViewProgressEvent) => {
          if (!jsInjected && e.nativeEvent.progress > 0.75) {
            if (webview.current) {
              webview.current.injectJavaScript(injectThemeJs())
              webview.current.injectJavaScript(injectJs())
              setJsInjected(true)
            } else Alert.alert("Error", "Webview not ready")
          }
        }}
        onNavigationStateChange={handleWebViewNavigationStateChange}
        onMessage={onMessageHandler(webview as React.MutableRefObject<WebView>, {
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
        })}
        style={styles.full}
      />
    </Screen>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  full: { width: "100%", height: "100%", flex: 1, backgroundColor: colors.transparent },
  iconContainer: {
    marginLeft: 10,
  },
}))
