import React, { useCallback, useEffect, useRef, useState } from "react"
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native"
import { Camera, CameraType } from "react-native-camera-kit"
import { check, request, PERMISSIONS, RESULTS } from "react-native-permissions"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import Svg, { Circle } from "react-native-svg"

import { useIsFocused, useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { Screen } from "@app/components/screen"
import { ScreenSecurityGate } from "@app/components/screen-security-gate"
import { useI18nContext } from "@app/i18n/i18n-react"
import { TranslationFunctions } from "@app/i18n/i18n-types"
import { PhraseStep, RootStackParamList } from "@app/navigation/stack-param-lists"
import { testProps } from "@app/utils/testProps"
import { toastShow } from "@app/utils/toast"

import { decodeSeedQr, SeedQrStatus } from "./seed-qr"

const CLOSE_BUTTON_GAP = 16
const LABEL_GAP = 30

type RejectedStatus = Exclude<SeedQrStatus, typeof SeedQrStatus.Ok>

/** Fixed copy only: toastShow sends the English message to analytics word for word, so
 *  anything read from the code must never reach it. */
const rejectionMessage: Record<RejectedStatus, (LL: TranslationFunctions) => string> = {
  [SeedQrStatus.Invalid]: (LL) => LL.RestoreScreen.seedQrInvalid(),
  [SeedQrStatus.Only12Words]: (LL) => LL.RestoreScreen.seedQrOnly12Words(),
  [SeedQrStatus.NotSeedQr]: (LL) => LL.RestoreScreen.seedQrNotSeedQr(),
  [SeedQrStatus.Unreadable]: (LL) => LL.RestoreScreen.seedQrUnreadable(),
}

type ReadCodeEvent = {
  nativeEvent: { codeStringValue?: string; codeRawBase64?: string }
}

/** The QR in the viewfinder is the seed itself, so the camera only runs behind the
 *  screenshot guard. Nothing read here is logged, reported or kept in state: the words
 *  go straight back to the phrase screen, which handles them as a paste. */
const SeedQrScannerContent: React.FC = () => {
  const { LL } = useI18nContext()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const isFocused = useIsFocused()
  const insets = useSafeAreaInsets()
  const { width, height } = useWindowDimensions()
  const styles = useStyles({ shortestEdge: Math.min(width, height) })
  const {
    theme: { colors },
  } = useTheme()

  const [hasPermission, setHasPermission] = useState(false)
  const [isCameraUnavailable, setIsCameraUnavailable] = useState(false)
  /** The camera reports the same code many times a second: one scan is acted on, and a
   *  rejection toasts once until it hides. */
  const doneRef = useRef(false)
  const toastedRef = useRef<RejectedStatus | null>(null)

  useEffect(() => {
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

  const handleReadCode = useCallback(
    ({ nativeEvent }: ReadCodeEvent) => {
      if (doneRef.current) return
      const result = decodeSeedQr({
        text: nativeEvent.codeStringValue,
        rawBytes: nativeEvent.codeRawBase64
          ? Uint8Array.from(Buffer.from(nativeEvent.codeRawBase64, "base64"))
          : undefined,
      })

      if (result.status === SeedQrStatus.Ok) {
        doneRef.current = true
        navigation.popTo("selfCustodialRestorePhrase", {
          step: PhraseStep.First,
          scannedWords: result.words,
        })
        return
      }

      if (toastedRef.current === result.status) return
      toastedRef.current = result.status
      toastShow({
        message: rejectionMessage[result.status],
        LL,
        onHide: () => {
          toastedRef.current = null
        },
      })
    },
    [navigation, LL],
  )

  if (isCameraUnavailable) {
    return (
      <Screen headerShown={false}>
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
      <Screen headerShown={false}>
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
          allowedBarcodeTypes={["qr"]}
          onReadCode={handleReadCode}
          style={StyleSheet.absoluteFill}
        />
      )}
      <View style={StyleSheet.absoluteFill}>
        <View style={styles.rectangleContainer}>
          <View style={styles.rectangle} />
        </View>
        <Pressable
          onPress={navigation.goBack}
          accessibilityRole="button"
          {...testProps("seed-qr-scanner-close")}
          accessibilityLabel={LL.common.close()}
        >
          <View style={[styles.close, { marginTop: insets.top + CLOSE_BUTTON_GAP }]}>
            <Svg viewBox="0 0 100 100">
              <Circle cx={50} cy={50} r={50} fill={colors.staticWhite} opacity={0.5} />
            </Svg>
            <GaloyIcon name="close" size={40} style={styles.iconClose} />
          </View>
        </Pressable>
        <Text style={[styles.label, { bottom: insets.bottom + LABEL_GAP }]}>
          {LL.RestoreScreen.scanSeedQr()}
        </Text>
      </View>
    </Screen>
  )
}

export const SeedQrScannerScreen: React.FC = () => {
  const navigation = useNavigation()
  return (
    <ScreenSecurityGate onBack={navigation.goBack}>
      <SeedQrScannerContent />
    </ScreenSecurityGate>
  )
}

const useStyles = makeStyles(
  ({ colors }, { shortestEdge }: { shortestEdge: number }) => ({
    close: {
      alignSelf: "flex-end",
      height: 56,
      marginRight: 10,
      width: 56,
    },
    iconClose: { position: "absolute", top: 8, left: 8, color: colors.staticBlack },
    rectangleContainer: {
      position: "absolute",
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      alignItems: "center",
      justifyContent: "center",
    },
    rectangle: {
      borderColor: colors.accent,
      borderWidth: 2,
      height: shortestEdge * 0.73,
      width: shortestEdge * 0.73,
    },
    label: {
      position: "absolute",
      left: 20,
      right: 20,
      textAlign: "center",
      fontSize: 24,
      lineHeight: 32,
      color: colors.staticWhite,
    },
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
