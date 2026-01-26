import * as React from "react"
import {
  Alert,
  Dimensions,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native"
import { launchImageLibrary } from "react-native-image-picker"
import Svg, { Circle } from "react-native-svg"
import Icon from "react-native-vector-icons/Ionicons"
import { Camera, CameraType } from "react-native-camera-kit"
import { check, request, PERMISSIONS, RESULTS } from "react-native-permissions"
import RNQRGenerator from "rn-qr-generator"

import { gql } from "@apollo/client"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { LNURL_DOMAINS } from "@app/config"
import {
  useAccountDefaultWalletLazyQuery,
  useRealtimePriceQuery,
  useScanningQrCodeScreenQuery,
} from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { useDisplayCurrency } from "@app/hooks/use-display-currency"
import { useI18nContext } from "@app/i18n/i18n-react"
import { logParseDestinationResult } from "@app/utils/analytics"
import { toastShow } from "@app/utils/toast"
import Clipboard from "@react-native-clipboard/clipboard"
import crashlytics from "@react-native-firebase/crashlytics"
import { useIsFocused, useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import { Text, makeStyles, useTheme } from "@rn-vui/themed"

import { Screen } from "../../components/screen"
import { RootStackParamList } from "../../navigation/stack-param-lists"
import { parseDestination } from "./payment-destination"
import { DestinationDirection } from "./payment-destination/index.types"

const { width: screenWidth } = Dimensions.get("window")
const { height: screenHeight } = Dimensions.get("window")

gql`
  query scanningQRCodeScreen {
    globals {
      network
    }
    me {
      id
      defaultAccount {
        id
        wallets {
          id
        }
      }
      contacts {
        id
        handle
        username
      }
    }
  }
`

export const ScanningQRCodeScreen: React.FC = () => {
  const navigation =
    useNavigation<StackNavigationProp<RootStackParamList, "sendBitcoinDestination">>()
  const isFocused = useIsFocused()

  // forcing price refresh
  useRealtimePriceQuery({ fetchPolicy: "network-only" })

  const {
    theme: { colors },
  } = useTheme()

  const [pending, setPending] = React.useState(false)
  const [scannedCache, setScannedCache] = React.useState(new Set<string>())
  const [hasPermission, setHasPermission] = React.useState(false)
  const [isCameraUnavailable, setIsCameraUnavailable] = React.useState(false)

  const { data } = useScanningQrCodeScreenQuery({ skip: !useIsAuthed() })
  const wallets = data?.me?.defaultAccount.wallets
  const bitcoinNetwork = data?.globals?.network
  const [accountDefaultWalletQuery] = useAccountDefaultWalletLazyQuery({
    fetchPolicy: "no-cache",
  })

  const { LL } = useI18nContext()
  const { displayCurrency } = useDisplayCurrency()

  React.useEffect(() => {
    if (!isFocused) {
      setScannedCache(new Set<string>())
    }
  }, [isFocused])

  React.useEffect(() => {
    const checkPermission = async () => {
      const permission =
        Platform.OS === "ios" ? PERMISSIONS.IOS.CAMERA : PERMISSIONS.ANDROID.CAMERA
      const result = await check(permission)
      if (result === RESULTS.GRANTED) {
        setHasPermission(true)
        return
      }
      const requestResult = await request(permission)
      if (requestResult === RESULTS.UNAVAILABLE) {
        setIsCameraUnavailable(true)
        return
      }
      setHasPermission(requestResult === RESULTS.GRANTED)
    }
    checkPermission()
  }, [])

  const loadInBrowser = (url: string) => {
    Linking.openURL(url).catch((err) => Alert.alert(err.toString()))
  }

  function isValidHttpUrl(input: string) {
    let url

    try {
      url = new URL(input)
    } catch (_) {
      return false
    }

    return url.protocol === "http:" || url.protocol === "https:"
  }

  const processInvoice = React.useMemo(() => {
    return async (data: string | undefined) => {
      if (pending || !wallets || !bitcoinNetwork || !data) {
        return
      }
      try {
        setPending(true)

        const destination = await parseDestination({
          rawInput: data,
          myWalletIds: wallets.map((wallet) => wallet.id),
          bitcoinNetwork,
          lnurlDomains: LNURL_DOMAINS,
          accountDefaultWalletQuery,
          inputSource: "qr",
          displayCurrency,
        })
        logParseDestinationResult(destination)

        if (destination.valid) {
          if (destination.destinationDirection === DestinationDirection.Send) {
            navigation.replace("sendBitcoinDetails", {
              paymentDestination: destination,
            })
            return
          }

          navigation.reset({
            routes: [
              {
                name: "Primary",
              },
              {
                name: "redeemBitcoinDetail",
                params: {
                  receiveDestination: destination,
                },
              },
            ],
          })
          return
        }
        switch (destination.invalidReason) {
          case "InvoiceExpired":
            Alert.alert(
              LL.ScanningQRCodeScreen.invalidTitle(),
              LL.ScanningQRCodeScreen.expiredContent({
                found: data.toString(),
              }),
              [
                {
                  text: LL.common.ok(),
                  onPress: () => setPending(false),
                },
              ],
            )
            break
          case "UnknownDestination":
            if (isValidHttpUrl(data.toString())) {
              Alert.alert(
                LL.ScanningQRCodeScreen.openLinkTitle(),
                `${data.toString()}\n\n${LL.ScanningQRCodeScreen.confirmOpenLink()}`,
                [
                  {
                    text: LL.common.No(),
                    onPress: () => setPending(false),
                  },
                  {
                    text: LL.common.yes(),
                    onPress: () => {
                      setPending(false)
                      loadInBrowser(data.toString())
                    },
                  },
                ],
              )
            } else {
              Alert.alert(
                LL.ScanningQRCodeScreen.invalidTitle(),
                LL.ScanningQRCodeScreen.invalidContent({
                  found: data.toString(),
                }),
                [
                  {
                    text: LL.common.ok(),
                    onPress: () => setPending(false),
                  },
                ],
              )
            }
            break
          default:
            Alert.alert(
              LL.ScanningQRCodeScreen.invalidTitle(),
              LL.ScanningQRCodeScreen.invalidContent({
                found: data.toString(),
              }),
              [
                {
                  text: LL.common.ok(),
                  onPress: () => setPending(false),
                },
              ],
            )
            break
        }
      } catch (err: unknown) {
        if (err instanceof Error) {
          crashlytics().recordError(err)
          Alert.alert(err.toString(), "", [
            {
              text: LL.common.ok(),
              onPress: () => setPending(false),
            },
          ])
        }
      }
    }
  }, [
    LL.ScanningQRCodeScreen,
    LL.common,
    navigation,
    pending,
    bitcoinNetwork,
    wallets,
    accountDefaultWalletQuery,
    displayCurrency,
  ])

  const handleCodeScanned = React.useCallback(
    (data: string) => {
      if (!scannedCache.has(data)) {
        setScannedCache(new Set(scannedCache).add(data))
        processInvoice(data)
      }
    },
    [scannedCache, processInvoice],
  )

  const styles = useStyles()

  const handleInvoicePaste = async () => {
    try {
      const data = await Clipboard.getString()
      processInvoice(data)
    } catch (err: unknown) {
      if (err instanceof Error) {
        crashlytics().recordError(err)
        Alert.alert(err.toString())
      }
    }
  }

  const showImagePicker = async () => {
    try {
      const result = await launchImageLibrary({ mediaType: "photo" })
      if (result.errorCode === "permission") {
        toastShow({
          message: (translations) =>
            translations.ScanningQRCodeScreen.imageLibraryPermissionsNotGranted(),
          LL,
        })
      }
      if (result.assets && result.assets.length > 0) {
        const { uri } = result.assets[0]
        const qrCodeValues = await RNQRGenerator.detect({ uri })
        if (qrCodeValues && qrCodeValues.values.length > 0) {
          processInvoice(qrCodeValues.values[0])
          return
        }
        Alert.alert(LL.ScanningQRCodeScreen.noQrCode())
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        crashlytics().recordError(err)
        Alert.alert(err.toString())
      }
    }
  }

  const onError = React.useCallback(
    (event: { nativeEvent: { errorMessage: string } }) => {
      console.error(event.nativeEvent.errorMessage)
    },
    [],
  )

  if (isCameraUnavailable) {
    return (
      <Screen>
        <View style={styles.permissionMissing}>
          <Text type="h1" style={styles.permissionMissingText}>
            {LL.ScanningQRCodeScreen.noCamera()}
          </Text>
        </View>
      </Screen>
    )
  }

  if (!hasPermission) {
    const openSettings = () => {
      Linking.openSettings().catch(() => {
        Alert.alert(LL.ScanningQRCodeScreen.unableToOpenSettings())
      })
    }

    return (
      <Screen>
        <View style={styles.permissionMissing}>
          <Text type="h1" style={styles.permissionMissingText}>
            {LL.ScanningQRCodeScreen.permissionCamera()}
          </Text>
          <GaloyPrimaryButton
            title={LL.ScanningQRCodeScreen.openSettings()}
            onPress={openSettings}
          />
        </View>
      </Screen>
    )
  }

  return (
    <Screen unsafe>
      {isFocused && (
        <Camera
          cameraType={CameraType.Back}
          focusMode="on"
          zoomMode="on"
          scanBarcode={true}
          onReadCode={(event) => handleCodeScanned(event.nativeEvent.codeStringValue)}
          onError={onError}
          style={StyleSheet.absoluteFill}
        />
      )}
      <View style={StyleSheet.absoluteFill}>
        <View style={styles.rectangleContainer}>
          <View style={styles.rectangle} />
        </View>
        <Pressable onPress={navigation.goBack}>
          <View style={styles.close}>
            <Svg viewBox="0 0 100 100">
              <Circle cx={50} cy={50} r={50} fill={colors._white} opacity={0.5} />
            </Svg>
            <Icon name="close" size={64} style={styles.iconClose} />
          </View>
        </Pressable>
        <View style={styles.openGallery}>
          <Pressable onPress={showImagePicker}>
            <Icon
              name="image"
              size={64}
              color={colors._lightGrey}
              style={styles.iconGalery}
            />
          </Pressable>
          <Pressable onPress={handleInvoicePaste}>
            {/* we could Paste from "FontAwesome" but as svg*/}
            <Icon
              name="clipboard-outline"
              size={64}
              color={colors._lightGrey}
              style={styles.iconClipboard}
            />
          </Pressable>
        </View>
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  close: {
    alignSelf: "flex-end",
    height: 64,
    marginRight: 16,
    marginTop: 40,
    width: 64,
  },

  openGallery: {
    height: 128,
    left: 32,
    position: "absolute",
    top: screenHeight - 96,
    width: screenWidth,
  },

  rectangle: {
    borderColor: colors.primary,
    borderWidth: 2,
    height: screenWidth * 0.75,
    width: screenWidth * 0.75,
  },

  rectangleContainer: {
    alignItems: "center",
    bottom: 0,
    justifyContent: "center",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },

  iconClose: { position: "absolute", top: -2, color: colors._black },

  iconGalery: { opacity: 0.8 },

  iconClipboard: { opacity: 0.8, position: "absolute", bottom: "5%", right: "15%" },

  permissionMissing: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    rowGap: 32,
  },

  permissionMissingText: {
    width: "80%",
    textAlign: "center",
  },
}))
