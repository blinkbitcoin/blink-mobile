import React, { useRef } from "react"
import { Linking, StyleSheet, View } from "react-native"
import { WebView, WebViewMessageEvent } from "react-native-webview"
import { Screen } from "../../components/screen/screen"

const MAX_MSG_BYTES = 32 * 1024
const ALLOWED_ACTIONS = new Set([
  "open_subpage",
  "close_subpage",
  "finish_intial_loading",
  "launch_url",
  "share_certificate",
  "claim_reward",
])

const makeNonce = () => Math.random().toString(36).slice(2) + Date.now().toString(36)

export const AcademyScreen: React.FC = () => {
  const webViewRef = useRef<WebView>(null)
  const ALLOWED_HOSTS = ["app.simple-bitcoin.app", "auth-sba.app-learning.com"]
  const channelNonce = useRef(makeNonce())

  type MessageData = { action?: string; value?: string; nonce?: string }

  const onMessage = (event: WebViewMessageEvent) => {
    const raw = event.nativeEvent.data || ""
    if (raw.length > MAX_MSG_BYTES) return
    let data: MessageData | null = null
    try {
      data = JSON.parse(raw)
    } catch {
      return
    }

    if (!data?.nonce || data.nonce !== channelNonce.current) return
    if (!data.action || !ALLOWED_ACTIONS.has(data.action)) return
    switch (data.action) {
      case "open_subpage":
        // TODO: hide bottom bar when subpage is opened
        break
      case "close_subpage":
        // TODO: show bottom bar when subpage is closed
        break
      case "finish_intial_loading":
        break
      case "launch_url": {
        const url = data.value?.toString() ?? ""
        try {
          const u = new URL(url)
          if (u.protocol === "https:") Linking.openURL(u.toString())
        } catch (e) {
          console.error("Failed to launch URL:", e)
        }
        break
      }
      case "share_certificate": {
        // TODO: handle base64 PDF
        break
      }
      case "claim_reward": {
        // TODO: handle LNURL
        break
      }
    }
  }

  const injectedBefore = `
  (function () {
    // Ensure ReactNativeWebView object exists
    window.ReactNativeWebView = window.ReactNativeWebView || {};
    // Attach the nonce to it
    window.ReactNativeWebView.nonce = '${channelNonce.current}';
    // Also expose via <meta> in case your webapp prefers that
    var m = document.createElement('meta');
    m.name = 'react-native-webview-nonce';
    m.content = '${channelNonce.current}';
    document.head.appendChild(m);
  })();
  true;
`

  // TODO: This JWT should come from your backend and has to be a unique identifier so the progress of the user can be loaded
  const jwtToken = "[PUT YOUR JWT TOKEN HERE]"
  // TODO: Needs to be defined to the app locale
  const locale = "en"
  const topSafeAreaInset = 0
  const bottomSafeAreaInset = 0
  return (
    <Screen style={styles.screen}>
      <View style={styles.container}>
        <WebView
          ref={webViewRef}
          source={{
            uri: `https://app.simple-bitcoin.app/${locale}/inapp`,
            headers: {
              token: jwtToken,
              topSafeAreaInset: topSafeAreaInset.toString(),
              bottomSafeAreaInset: bottomSafeAreaInset.toString(),
            },
          }}
          incognito
          thirdPartyCookiesEnabled={false}
          sharedCookiesEnabled={false}
          mixedContentMode="never"
          allowFileAccess={false}
          allowFileAccessFromFileURLs={false}
          allowUniversalAccessFromFileURLs={false}
          setSupportMultipleWindows={false}
          javaScriptEnabled
          domStorageEnabled
          originWhitelist={[
            "https://app.simple-bitcoin.app",
            "https://auth-sba.app-learning.com",
          ]}
          onShouldStartLoadWithRequest={(req) => {
            try {
              const u = new URL(req.url)
              if (u.protocol !== "https:") return false
              if (!ALLOWED_HOSTS.includes(u.host)) {
                Linking.openURL(u.toString())
                return false
              }
              return true
            } catch {
              return false
            }
          }}
          injectedJavaScriptBeforeContentLoaded={injectedBefore}
          onMessage={onMessage}
          onLoadProgress={() => {}}
          cacheEnabled={false}
          cacheMode="LOAD_NO_CACHE"
          allowsBackForwardNavigationGestures
          style={styles.webview}
        />
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  screen: { flex: 1 },
  webview: { flex: 1 },
})
