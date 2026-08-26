import * as React from "react"
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native"
import { launchImageLibrary } from "react-native-image-picker"
import Svg, { Circle } from "react-native-svg"
import { Camera, CameraType } from "react-native-camera-kit"
import { check, request, PERMISSIONS, RESULTS } from "react-native-permissions"
import RNQRGenerator from "rn-qr-generator"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { gql } from "@apollo/client"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import {
  useAccountDefaultWalletLazyQuery,
  useRealtimePriceQuery,
} from "@app/graphql/generated"
import { useAppConfig } from "@app/hooks"
import { useDisplayCurrency } from "@app/hooks/use-display-currency"
import { useScanContext } from "@app/hooks/use-scan-context"
import { useSparkNetwork } from "@app/self-custodial/hooks/use-spark-network"
import { useSelfCustodialWallet } from "@app/self-custodial/providers/wallet"
import { useI18nContext } from "@app/i18n/i18n-react"
import { logParseDestinationResult } from "@app/utils/analytics"
import { reportError } from "@app/utils/error-logging"
import { toError } from "@app/utils/error-reporting"
import { toastShow } from "@app/utils/toast"
import Clipboard from "@react-native-clipboard/clipboard"
import { useIsFocused, useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { Text, makeStyles, useTheme } from "@rn-vui/themed"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { Screen } from "../../components/screen"
import { RootStackParamList } from "../../navigation/stack-param-lists"
import {
  DestinationDirection,
  isMerchantChoiceDestination,
} from "./payment-destination/index.types"
import { testProps } from "@app/utils/testProps"

import { resolveDestination } from "./payment-destination/resolve-destination"

/** Gaps kept between the scanner's own controls and whatever the system draws over the
 *  window. From Android 15 the window runs edge to edge, so the status bar and the
 *  navigation or gesture bar sit on top of the camera preview rather than beside it, and
 *  a control placed at a fixed offset from the window edge lands underneath them. */
const CLOSE_BUTTON_GAP = 16
const BOTTOM_CONTROLS_GAP = 24

/**
 * Longest side the picker is allowed to hand back. The QR decoder holds the decoded
 * bitmap and one integer per pixel on top of it, so its peak is eight bytes per pixel of
 * whatever it receives: a 12000x12000 photo asks for 576MB against a heap that caps out
 * around 200MB, and the app dies before reading anything. At this bound the peak is 34MB,
 * which the 96MB heap of a budget device survives. A code filling the frame stays well
 * inside what the decoder needs, eight or more pixels per module even at version 40, the
 * densest there is; a code occupying a small corner of a very large photo is the case
 * this trades away.
 */
const QR_IMAGE_MAX_DIMENSION = 2048

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
    useNavigation<
      NativeStackNavigationProp<RootStackParamList, "sendBitcoinDestination">
    >()
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

  const { myWalletIds, bitcoinNetwork, lnurlDomains } = useScanContext()
  const [accountDefaultWalletQuery] = useAccountDefaultWalletLazyQuery({
    fetchPolicy: "no-cache",
  })

  const { LL } = useI18nContext()
  const insets = useSafeAreaInsets()
  const { displayCurrency } = useDisplayCurrency()
  const { sdk } = useSelfCustodialWallet()
  const sparkNetwork = useSparkNetwork()
  const {
    appConfig: {
      galoyInstance: { lnAddressHostname },
    },
  } = useAppConfig()

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
      if (pending || !bitcoinNetwork || !data) {
        return
      }
      try {
        setPending(true)

        const destination = await resolveDestination(
          {
            rawInput: data,
            myWalletIds,
            bitcoinNetwork,
            lnurlDomains,
            accountDefaultWalletQuery,
            inputSource: "qr",
            displayCurrency,
          },
          { sdk, network: sparkNetwork },
          lnAddressHostname,
        )
        logParseDestinationResult(destination)

        if (destination.valid) {
          if (isMerchantChoiceDestination(destination)) {
            navigation.replace("merchantSelection", {
              merchants: destination.validDestination.merchants,
            })
            return
          }

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
          case "LnurlServiceError":
            Alert.alert(
              LL.ScanningQRCodeScreen.unresolvedTitle(),
              LL.ScanningQRCodeScreen.unresolvedContent({
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
        /** Narrowing on instanceof here would drop a rejection that is not an Error
         *  without ever reaching setPending(false), and pending gates every scan: the
         *  camera and the gallery button would both stay dead for the rest of the screen.
         *  What was rejected goes to error reporting rather than into the dialog, which
         *  would otherwise show the user a serialized native payload. */
        reportError("scanning-qrcode", toError(err))
        Alert.alert(LL.errors.unexpectedError(), "", [
          {
            text: LL.common.ok(),
            onPress: () => setPending(false),
          },
        ])
      }
    }
  }, [
    LL.ScanningQRCodeScreen,
    LL.common,
    LL.errors,
    navigation,
    pending,
    bitcoinNetwork,
    myWalletIds,
    lnurlDomains,
    accountDefaultWalletQuery,
    displayCurrency,
    sdk,
    sparkNetwork,
    lnAddressHostname,
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

  const { width, height } = useWindowDimensions()
  /** The viewfinder is square, so it is bounded by the shorter edge. Sizing it off
   *  the width put its horizontal borders off-screen once the screen could rotate. */
  const shortestEdge = Math.min(width, height)
  const styles = useStyles({ width, shortestEdge })

  const handleInvoicePaste = async () => {
    try {
      const data = await Clipboard.getString()
      processInvoice(data)
    } catch (err: unknown) {
      reportError("scanning-qrcode", toError(err))
      Alert.alert(LL.errors.unexpectedError())
    }
  }

  const showImagePicker = async () => {
    try {
      const result = await launchImageLibrary({
        mediaType: "photo",
        maxWidth: QR_IMAGE_MAX_DIMENSION,
        maxHeight: QR_IMAGE_MAX_DIMENSION,
      })
      if (result.errorCode === "permission") {
        toastShow({
          message: (translations) =>
            translations.ScanningQRCodeScreen.imageLibraryPermissionsNotGranted(),
          LL,
        })
        return
      }
      /** Every other code arrives with no assets, so without this the button reads as
       *  dead: nothing opens, nothing is said, and nothing reaches error reporting. The
       *  message stays generic because the picker failed before it could hand over a
       *  photo, and saying the image holds no QR would be a claim about something the app
       *  never got to look at. */
      if (result.errorCode) {
        reportError(
          "scanning-qrcode",
          new Error(
            `Image library failed: ${result.errorCode} ${result.errorMessage ?? ""}`,
          ),
        )
        Alert.alert(LL.errors.unexpectedError())
        return
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
      /** A native module can reject with a plain object or a string rather than an Error,
       *  and an Error crossing a realm boundary fails the instanceof check too. Narrowing
       *  on that check here would leave those rejections with no alert and nothing in
       *  error reporting, which is the dead button this change is closing. The detail goes
       *  to error reporting rather than to the user, who would otherwise be shown whatever
       *  the native module rejected with, serialized. */
      reportError("scanning-qrcode", toError(err))
      Alert.alert(LL.errors.unexpectedError())
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

  /** A scan already in flight makes processInvoice drop whatever the picker hands back,
   *  so opening it would read as a dead button. Dimming says the same thing the guard
   *  does, before the user spends a trip through the gallery on it. */
  const galleryIconStyle = pending ? styles.iconGaleryPending : styles.iconGalery
  const closeInsetStyle = { marginTop: insets.top + CLOSE_BUTTON_GAP }
  const bottomControlsInsetStyle = { bottom: insets.bottom + BOTTOM_CONTROLS_GAP }

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
          <View style={[styles.close, closeInsetStyle]}>
            <Svg viewBox="0 0 100 100">
              <Circle cx={50} cy={50} r={50} fill={colors._white} opacity={0.5} />
            </Svg>
            <GaloyIcon name="close" size={64} style={styles.iconClose} />
          </View>
        </Pressable>
        <View style={[styles.openGallery, bottomControlsInsetStyle]}>
          <Pressable
            {...testProps("open-gallery")}
            disabled={pending}
            onPress={showImagePicker}
          >
            <GaloyIcon
              name="image"
              size={64}
              color={colors._lightGrey}
              style={galleryIconStyle}
            />
          </Pressable>
          <Pressable onPress={handleInvoicePaste}>
            {/* we could Paste from "FontAwesome" but as svg*/}
            <GaloyIcon
              name="clipboard"
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

const useStyles = makeStyles(
  ({ colors }, { width, shortestEdge }: { width: number; shortestEdge: number }) => ({
    close: {
      alignSelf: "flex-end",
      height: 64,
      marginRight: 16,
      width: 64,
    },

    openGallery: {
      height: 64,
      left: 32,
      position: "absolute",
      width,
    },

    rectangle: {
      borderColor: colors.primary,
      borderWidth: 2,
      height: shortestEdge * 0.75,
      width: shortestEdge * 0.75,
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

    iconGaleryPending: { opacity: 0.4 },

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
  }),
)
