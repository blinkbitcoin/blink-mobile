import * as React from "react"
import { useMemo } from "react"
import {
  ActivityIndicator,
  StyleSheet,
  useWindowDimensions,
  View,
  Image,
  Platform,
  StyleProp,
  ViewStyle,
  Animated,
} from "react-native"
import { Gesture, GestureDetector } from "react-native-gesture-handler"
import { runOnJS } from "react-native-reanimated"
import QRCode from "react-native-qrcode-svg"

import Logo from "@app/assets/logo/blink-logo-icon.png"
import { usePressScale } from "@app/components/animations"
import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { GaloyTertiaryButton } from "@app/components/atomic/galoy-tertiary-button"
import { SuccessIconAnimation } from "@app/components/success-animation"
import { useI18nContext } from "@app/i18n/i18n-react"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { testProps } from "../../utils/testProps"
import { Invoice, InvoiceType, GetFullUriFn } from "./payment/index.types"

const configByType = {
  [Invoice.Lightning]: {
    copyToClipboardLabel: "ReceiveScreen.copyClipboard",
    shareButtonLabel: "common.shareLightning",
    ecl: "L" as const,
    icon: "flash",
  },
  [Invoice.OnChain]: {
    copyToClipboardLabel: "ReceiveScreen.copyClipboardBitcoin",
    shareButtonLabel: "common.shareBitcoin",
    ecl: "M" as const,
    icon: "logo-bitcoin",
  },
  // TODO: Add them
  [Invoice.PayCode]: {
    copyToClipboardLabel: "ReceiveScreen.copyClipboardBitcoin",
    shareButtonLabel: "common.shareBitcoin",
    ecl: "M" as const,
    icon: "logo-bitcoin",
  },
}

type Props = {
  type: InvoiceType
  getFullUri: GetFullUriFn | undefined
  loading: boolean
  completed: boolean
  err: string
  style?: StyleProp<ViewStyle>
  expired: boolean
  regenerateInvoiceFn?: () => void
  copyToClipboard?: () => void | undefined
  isPayCode: boolean
  canUsePayCode: boolean
  toggleIsSetLightningAddressModalVisible: () => void
}

export const QRView: React.FC<Props> = ({
  type,
  getFullUri,
  loading,
  completed,
  err,
  style,
  expired,
  regenerateInvoiceFn,
  copyToClipboard,
  isPayCode,
  canUsePayCode,
  toggleIsSetLightningAddressModalVisible,
}) => {
  const {
    theme: { colors },
  } = useTheme()
  const isPayCodeAndCanUsePayCode = isPayCode && canUsePayCode

  const isReady = (!isPayCodeAndCanUsePayCode || Boolean(getFullUri)) && !loading && !err
  const displayingQR =
    !completed && isReady && !expired && (!isPayCode || isPayCodeAndCanUsePayCode)

  const styles = useStyles()
  const { width, scale } = useWindowDimensions()

  const { LL } = useI18nContext()

  const { scaleValue, pressIn, pressOut } = usePressScale()

  const tapGesture = React.useMemo(
    () =>
      Gesture.Tap()
        .onBegin(() => {
          runOnJS(pressIn)()
        })
        .onEnd(() => {
          if (copyToClipboard) runOnJS(copyToClipboard)()
        })
        .onFinalize(() => {
          runOnJS(pressOut)()
        }),
    [pressIn, pressOut, copyToClipboard],
  )

  const renderSuccessView = useMemo(() => {
    if (completed) {
      return (
        <View {...testProps("Success Icon")} style={[styles.container, style]}>
          <SuccessIconAnimation>
            <GaloyIcon name={"payment-success"} size={128} />
          </SuccessIconAnimation>
        </View>
      )
    }
    return null
  }, [completed, styles, style])

  const renderQRCode = useMemo(() => {
    const baseSize = Math.round((250 / 360) * width) - 2 * 28
    const qrSize = Platform.OS === "android" && scale > 3 ? 240 : baseSize

    if (displayingQR && getFullUri) {
      const uri = getFullUri({ uppercase: true })
      return (
        <View style={[styles.container, style]} {...testProps("QR-Code")}>
          <View>
            <QRCode
              size={qrSize}
              value={uri}
              logoBackgroundColor="white"
              ecl={type && configByType[type].ecl}
              logoSize={60}
            />
            <View style={styles.logoOverlay}>
              <View style={styles.logoCircle}>
                <Image source={Logo} style={styles.logoImage} />
              </View>
            </View>
          </View>
        </View>
      )
    }
    return null
  }, [displayingQR, type, getFullUri, width, scale, styles, style])

  const renderStatusView = useMemo(() => {
    if (!completed && !isReady) {
      return (
        <View style={[styles.container, style]}>
          <View style={styles.errorContainer}>
            {(err !== "" && (
              <Text style={styles.error} selectable>
                {err}
              </Text>
            )) || <ActivityIndicator size="large" color={colors.primary} />}
          </View>
        </View>
      )
    } else if (expired) {
      return (
        <View style={[styles.container, style]}>
          <Text type="p2" style={styles.expiredInvoice}>
            {LL.ReceiveScreen.invoiceHasExpired()}
          </Text>
          <GaloyTertiaryButton
            title={LL.ReceiveScreen.regenerateInvoiceButtonTitle()}
            onPress={regenerateInvoiceFn}
          ></GaloyTertiaryButton>
        </View>
      )
    } else if (isPayCode && !canUsePayCode) {
      return (
        <View style={[styles.container, styles.cantUsePayCode, style]}>
          <Text type="p2" style={styles.cantUsePayCodeText}>
            {LL.ReceiveScreen.setUsernameToAcceptViaPaycode()}
          </Text>
          <GaloyTertiaryButton
            title={LL.ReceiveScreen.setUsernameButtonTitle()}
            onPress={toggleIsSetLightningAddressModalVisible}
          ></GaloyTertiaryButton>
        </View>
      )
    }
    return null
  }, [
    err,
    isReady,
    completed,
    styles,
    style,
    colors,
    expired,
    isPayCode,
    canUsePayCode,
    LL.ReceiveScreen,
    regenerateInvoiceFn,
    toggleIsSetLightningAddressModalVisible,
  ])

  return (
    <View style={styles.qr}>
      <GestureDetector gesture={displayingQR ? tapGesture : Gesture.Manual()}>
        <Animated.View style={{ transform: [{ scale: scaleValue }] }}>
          {renderSuccessView}
          {renderQRCode}
          {renderStatusView}
        </Animated.View>
      </GestureDetector>
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  container: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors._white,
    width: "100%",
    height: undefined,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: colors.grey5,
    aspectRatio: 1,
    alignSelf: "center",
    padding: 28,
  },
  errorContainer: {
    justifyContent: "center",
    height: "100%",
  },
  error: { color: colors.error, alignSelf: "center" },
  qr: {
    alignItems: "center",
  },
  expiredInvoice: {
    marginBottom: 10,
  },
  cantUsePayCode: {
    padding: "10%",
  },
  cantUsePayCodeText: {
    marginBottom: 10,
  },
  logoOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  logoCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "white",
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  logoImage: {
    width: 48,
    height: 48,
  },
}))

export default React.memo(QRView)
