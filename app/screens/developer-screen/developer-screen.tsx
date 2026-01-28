import * as React from "react"
import { Alert, DevSettings, Linking, View, Share } from "react-native"
import DeviceInfo from "react-native-device-info"
import { ScrollView } from "react-native-gesture-handler"
import InAppReview from "react-native-in-app-review"
import { InAppBrowser } from "react-native-inappbrowser-reborn"

import { gql, useApolloClient } from "@apollo/client"
import { GaloyInput } from "@app/components/atomic/galoy-input"
import { GALOY_INSTANCES, possibleGaloyInstanceNames } from "@app/config"
import { activateBeta } from "@app/graphql/client-only-query"
import { useBetaQuery, useDebugScreenQuery, useLevelQuery } from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { useAppConfig } from "@app/hooks/use-app-config"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import Clipboard from "@react-native-clipboard/clipboard"
import crashlytics from "@react-native-firebase/crashlytics"
import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import { Button, Text, makeStyles } from "@rn-vui/themed"

import { Screen } from "../../components/screen"
import { usePriceConversion, useSaveSessionProfile } from "@app/hooks"
import useLogout from "../../hooks/use-logout"
import { addDeviceToken } from "../../utils/notifications"
import { testProps } from "../../utils/testProps"
import useAppCheckToken from "../get-started-screen/use-device-token"

gql`
  query debugScreen {
    me {
      id
      defaultAccount {
        id
      }
    }
  }
`

const usingHermes = typeof HermesInternal === "object" && HermesInternal !== null

export const DeveloperScreen: React.FC = () => {
  const styles = useStyles()
  const client = useApolloClient()
  const { usdPerSat } = usePriceConversion()
  const { logout } = useLogout()
  const { saveProfile } = useSaveSessionProfile()

  const { navigate } = useNavigation<StackNavigationProp<RootStackParamList>>()

  const { appConfig, saveTokenAndInstance } = useAppConfig()
  const token = appConfig.token

  const { data: dataLevel } = useLevelQuery({ fetchPolicy: "cache-only" })
  const level = String(dataLevel?.me?.defaultAccount?.level)

  const { data: dataDebug } = useDebugScreenQuery()
  const accountId = dataDebug?.me?.defaultAccount?.id

  const currentGaloyInstance = appConfig.galoyInstance

  const [urlWebView, setUrlWebView] = React.useState(currentGaloyInstance.fiatUrl)
  const [urlInAppBrowser, setUrlInAppBrowser] = React.useState(
    currentGaloyInstance.kycUrl,
  )

  React.useEffect(() => {
    setUrlWebView(`${currentGaloyInstance.fiatUrl}?accountId=${accountId}`)
    setUrlInAppBrowser(`${currentGaloyInstance.kycUrl}?accountId=${accountId}`)
  }, [accountId, currentGaloyInstance.fiatUrl, currentGaloyInstance.kycUrl])

  const [newToken, setNewToken] = React.useState(token)
  const [hasFlowFinishedSuccessfully, setHasFlowFinishedSuccessfully] = React.useState<
    undefined | boolean
  >(undefined)

  const [newGraphqlUri, setNewGraphqlUri] = React.useState(
    currentGaloyInstance.id === "Custom" ? currentGaloyInstance.graphqlUri : "",
  )
  const [newGraphqlWslUri, setNewGraphqlWslUri] = React.useState(
    currentGaloyInstance.id === "Custom" ? currentGaloyInstance.graphqlWsUri : "",
  )
  const [newPosUrl, setNewPosUrl] = React.useState(
    currentGaloyInstance.id === "Custom" ? currentGaloyInstance.posUrl : "",
  )

  const [newKycUrl, setNewKycUrl] = React.useState(
    currentGaloyInstance.id === "Custom" ? currentGaloyInstance.kycUrl : "",
  )

  const [newFiatUrl, setNewFiatUrl] = React.useState(
    currentGaloyInstance.id === "Custom" ? currentGaloyInstance.fiatUrl : "",
  )

  const [newRestUrl, setNewRestUrl] = React.useState(
    currentGaloyInstance.id === "Custom" ? currentGaloyInstance.authUrl : "",
  )

  const [newLnAddressHostname, setNewLnAddressHostname] = React.useState(
    currentGaloyInstance.id === "Custom" ? currentGaloyInstance.lnAddressHostname : "",
  )

  const [newGaloyInstance, setNewGaloyInstance] = React.useState(currentGaloyInstance.id)

  const isAuthed = useIsAuthed()
  const dataBeta = useBetaQuery({ skip: !isAuthed })
  const beta = dataBeta.data?.beta ?? false

  const changesHaveBeenMade =
    newToken !== token ||
    (newGaloyInstance !== currentGaloyInstance.id && newGaloyInstance !== "Custom") ||
    (newGaloyInstance === "Custom" &&
      Boolean(newGraphqlUri) &&
      Boolean(newGraphqlWslUri) &&
      Boolean(newPosUrl) &&
      Boolean(newRestUrl) &&
      (newGraphqlUri !== currentGaloyInstance.graphqlUri ||
        newGraphqlWslUri !== currentGaloyInstance.graphqlWsUri ||
        newPosUrl !== currentGaloyInstance.posUrl ||
        newKycUrl !== currentGaloyInstance.kycUrl ||
        newFiatUrl !== currentGaloyInstance.fiatUrl ||
        newRestUrl !== currentGaloyInstance.authUrl ||
        newLnAddressHostname !== currentGaloyInstance.lnAddressHostname))

  React.useEffect(() => {
    if (newGaloyInstance === currentGaloyInstance.id) {
      setNewToken(token)
    } else {
      setNewToken("")
    }
  }, [newGaloyInstance, currentGaloyInstance, token])

  const appCheckToken = useAppCheckToken({})

  const openInAppBrowser = async () => {
    try {
      if (await InAppBrowser.isAvailable()) {
        const result = await InAppBrowser.open(urlInAppBrowser, {
          // iOS Properties
          dismissButtonStyle: "cancel",
          preferredBarTintColor: "#453AA4",
          preferredControlTintColor: "white",
          readerMode: false,
          animated: true,
          modalPresentationStyle: "fullScreen",
          modalTransitionStyle: "coverVertical",
          modalEnabled: true,
          enableBarCollapsing: false,
          // Android Properties
          showTitle: true,
          toolbarColor: "#6200EE",
          secondaryToolbarColor: "black",
          navigationBarColor: "black",
          navigationBarDividerColor: "white",
          enableUrlBarHiding: true,
          enableDefaultShare: true,
          forceCloseOnRedirection: false,
          // Specify full animation resource identifier(package:anim/name)
          // or only resource name(in case of animation bundled with app).
          animations: {
            startEnter: "slide_in_right",
            startExit: "slide_out_left",
            endEnter: "slide_in_left",
            endExit: "slide_out_right",
          },
          headers: {
            "my-custom-header": "my custom header value",
          },
          hasBackButton: true,
        })
        // await this.sleep(800)
        Alert.alert(JSON.stringify(result))
      } else Linking.openURL(urlInAppBrowser)
    } catch (error) {
      if (error instanceof Error) {
        Alert.alert(error.message)
      }
    }
  }

  const handleSave = async () => {
    await logout({ stateToDefault: false })

    if (newGaloyInstance === "Custom") {
      await saveTokenAndInstance({
        instance: {
          id: "Custom",
          graphqlUri: newGraphqlUri,
          graphqlWsUri: newGraphqlWslUri,
          authUrl: newRestUrl,
          posUrl: newPosUrl,
          kycUrl: newKycUrl,
          fiatUrl: newFiatUrl,
          lnAddressHostname: newLnAddressHostname,
          name: "Custom", // TODO: make configurable
          blockExplorer: "https://mempool.space/tx/", // TODO make configurable
        },
        token: newToken || "",
      })
      await saveProfile(newToken || "")
    }

    const newGaloyInstanceObject = GALOY_INSTANCES.find(
      (instance) => instance.id === newGaloyInstance,
    )

    if (newGaloyInstanceObject) {
      await saveTokenAndInstance({
        instance: newGaloyInstanceObject,
        token: newToken || "",
      })
      await saveProfile(newToken || "")
      return
    }

    await saveProfile(newToken || "")
  }

  return (
    <Screen>
      <ScrollView {...testProps("developer-screen-scroll-view")}>
        <View style={styles.screenContainer}>
          <Button
            title="Log out"
            containerStyle={styles.button}
            onPress={async () => {
              await logout()
              Alert.alert("state successfully deleted. Restart your app")
            }}
            {...testProps("logout button")}
          />
          <Button
            title="Send device token"
            containerStyle={styles.button}
            onPress={async () => {
              if (token && client) {
                addDeviceToken(client)
              }
            }}
          />
          <Button
            title={`Beta features: ${beta}`}
            containerStyle={styles.button}
            onPress={async () => activateBeta(client, !beta)}
          />
          {__DEV__ && (
            <>
              <Button
                title="Reload"
                containerStyle={styles.button}
                onPress={() => DevSettings.reload()}
              />
              <Button
                title="Crash test"
                containerStyle={styles.button}
                onPress={() => {
                  crashlytics().log("Testing crash")
                  crashlytics().crash()
                }}
              />
            </>
          )}
          <GaloyInput
            {...testProps("Url in app browser")}
            label="Url in app browser"
            value={urlInAppBrowser}
            onChangeText={setUrlInAppBrowser}
            selectTextOnFocus
          />
          <Button
            title="Open in app browser"
            containerStyle={styles.button}
            {...testProps("Open in app browser")}
            onPress={openInAppBrowser}
          />
          <GaloyInput
            {...testProps("Url webview")}
            label="Url webview"
            value={urlWebView}
            onChangeText={setUrlWebView}
            selectTextOnFocus
          />
          <Button
            title="Navigate to webview"
            containerStyle={styles.button}
            {...testProps("Navigate to webview")}
            onPress={() =>
              navigate("webView", {
                url: urlWebView,
              })
            }
          />
          <Text>InAppReview available: {String(InAppReview.isAvailable())}</Text>
          <Text>result InAppReview: {String(hasFlowFinishedSuccessfully)}</Text>
          <Button
            title="Rate us"
            containerStyle={styles.button}
            {...testProps("Rate us")}
            onPress={() =>
              InAppReview.RequestInAppReview().then(setHasFlowFinishedSuccessfully)
            }
          />
          <View>
            <Text style={styles.textHeader}>{DeviceInfo.getReadableVersion()}</Text>
            <Text style={styles.textHeader}>Account info</Text>
            <Text>AccountId: </Text>
            <Text selectable>{accountId}</Text>
            <Text>Level: {level}</Text>
            <Text>Token Present: {String(Boolean(token))}</Text>
            <Text style={styles.textHeader}>Environment Information</Text>
            <Text selectable>Galoy Instance: {appConfig.galoyInstance.id}</Text>
            <Text selectable>GQL_URL: {appConfig.galoyInstance.graphqlUri}</Text>
            <Text selectable>GQL_WS_URL: {appConfig.galoyInstance.graphqlWsUri}</Text>
            <Text selectable>POS URL: {appConfig.galoyInstance.posUrl}</Text>
            <Text selectable>
              LN Address Hostname: {appConfig.galoyInstance.lnAddressHostname}
            </Text>
            <Text selectable>
              per 1 sat: {usdPerSat ? `$${usdPerSat}` : "No price data"}
            </Text>
            <Text>Hermes: {String(Boolean(usingHermes))}</Text>
            <Button
              {...testProps("Save Changes")}
              title="Save changes"
              style={styles.button}
              onPress={handleSave}
              disabled={!changesHaveBeenMade}
            />
            <Text style={styles.textHeader}>Update Environment</Text>
            {possibleGaloyInstanceNames.map((instanceName) => (
              <Button
                key={instanceName}
                title={instanceName}
                onPress={() => {
                  setNewGaloyInstance(instanceName)
                }}
                {...testProps(`${instanceName} button`)}
                buttonStyle={
                  instanceName === newGaloyInstance
                    ? styles.selectedInstanceButton
                    : styles.notSelectedInstanceButton
                }
                titleStyle={
                  instanceName === newGaloyInstance
                    ? styles.selectedInstanceButton
                    : styles.notSelectedInstanceButton
                }
                containerStyle={
                  instanceName === newGaloyInstance
                    ? styles.selectedInstanceButton
                    : styles.notSelectedInstanceButton
                }
                {...testProps(`${instanceName} Button`)}
              />
            ))}
            <GaloyInput
              {...testProps("Input access token")}
              label="Access Token"
              placeholder={"Access token"}
              value={newToken}
              secureTextEntry={true}
              onChangeText={setNewToken}
              selectTextOnFocus
            />
            <Button
              {...testProps("Copy access token")}
              title="Copy access token"
              containerStyle={styles.button}
              onPress={async () => {
                Clipboard.setString(newToken || "")
                Alert.alert("Token copied in clipboard.")
              }}
              disabled={!newToken}
            />
            <Button
              {...testProps("Share access token")}
              title="Share access token"
              containerStyle={styles.button}
              onPress={async () => {
                Share.share({ message: newToken || "" })
              }}
              disabled={!newToken}
            />
            {newGaloyInstance === "Custom" && (
              <>
                <GaloyInput
                  label="Graphql Uri"
                  placeholder={"Graphql Uri"}
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={newGraphqlUri}
                  onChangeText={setNewGraphqlUri}
                  selectTextOnFocus
                />
                <GaloyInput
                  label="Graphql Ws Uri"
                  placeholder={"Graphql Ws Uri"}
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={newGraphqlWslUri}
                  onChangeText={setNewGraphqlWslUri}
                  selectTextOnFocus
                />
                <GaloyInput
                  label="POS Url"
                  placeholder={"POS Url"}
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={newPosUrl}
                  onChangeText={setNewPosUrl}
                  selectTextOnFocus
                />
                <GaloyInput
                  label="Kyc Url"
                  placeholder={"Kyc Url"}
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={newKycUrl}
                  onChangeText={setNewKycUrl}
                  selectTextOnFocus
                />
                <GaloyInput
                  label="Fiat Url"
                  placeholder={"Fiat Url"}
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={newFiatUrl}
                  onChangeText={setNewFiatUrl}
                  selectTextOnFocus
                />
                <GaloyInput
                  label="Rest Url"
                  placeholder={"Rest Url"}
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={newRestUrl}
                  onChangeText={setNewRestUrl}
                  selectTextOnFocus
                />
                <GaloyInput
                  label="LN Address Hostname"
                  placeholder={"LN Address Hostname"}
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={newLnAddressHostname}
                  onChangeText={setNewLnAddressHostname}
                  selectTextOnFocus
                />
              </>
            )}
            <Text selectable>{appCheckToken}</Text>
          </View>
        </View>
      </ScrollView>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  button: {
    marginVertical: 6,
  },
  screenContainer: {
    marginHorizontal: 12,
    marginBottom: 40,
  },
  textHeader: {
    fontSize: 18,
    marginVertical: 12,
  },
  selectedInstanceButton: {
    backgroundColor: colors.grey5,
    color: colors.white,
  },
  notSelectedInstanceButton: {
    backgroundColor: colors.white,
    color: colors.grey3,
  },
}))
