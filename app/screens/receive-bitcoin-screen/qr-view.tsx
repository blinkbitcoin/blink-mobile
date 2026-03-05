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

// QR code sizing: base size scales with screen width, capped on high-DPI Android devices
const QR_BASE_RATIO = 250 / 360
const QR_CONTAINER_PADDING = 28
const QR_ANDROID_HIGH_DPI_SIZE = 240
const QR_ANDROID_HIGH_DPI_SCALE = 3

const configByType = {
  [Invoice.Lightning]: {
    ecl: "L" as const,
  },
  [Invoice.OnChain]: {
    ecl: "M" as const,
  },
  [Invoice.PayCode]: {
    ecl: "M" as const,
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
  copyToClipboard?: () => void
  isPayCode: boolean
  canUsePayCode: boolean
  toggleIsSetLightningAddressModalVisible: () => void
}

const QRViewBase: React.FC<Props> = ({
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
  const baseSize = Math.round(QR_BASE_RATIO * width) - 2 * QR_CONTAINER_PADDING
  const qrSize =
    Platform.OS === "android" && scale > QR_ANDROID_HIGH_DPI_SCALE
      ? QR_ANDROID_HIGH_DPI_SIZE
      : baseSize

  const { LL } = useI18nContext()

  const { scaleValue, pressIn, pressOut } = usePressScale()

  const tapGesture = useMemo(
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

  const animatedStyle = useMemo(
    () => ({ transform: [{ scale: scaleValue }] }) as const,
    [scaleValue],
  )

  const renderContent = () => {
    if (completed) {
      return (
        <View {...testProps("Success Icon")} style={[styles.container, style]}>
          <SuccessIconAnimation>
            <GaloyIcon name="payment-success" size={128} />
          </SuccessIconAnimation>
        </View>
      )
    }

    if (displayingQR && getFullUri) {
      const uri = getFullUri({ uppercase: true })

      return (
        <View style={[styles.container, style]} {...testProps("QR-Code")}>
          <View>
            <QRCode
              size={qrSize}
              value={uri}
              logoBackgroundColor="white"
              ecl={configByType[type].ecl}
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

    if (!isReady) {
      return (
        <View style={[styles.container, style]}>
          <View style={styles.errorContainer}>
            {err ? (
              <Text style={styles.error} selectable>
                {err}
              </Text>
            ) : (
              <ActivityIndicator size="large" color={colors.primary} />
            )}
          </View>
        </View>
      )
    }

    if (expired) {
      return (
        <View style={[styles.container, style]}>
          <Text type="p2" style={styles.expiredInvoice}>
            {LL.ReceiveScreen.invoiceHasExpired()}
          </Text>
          <GaloyTertiaryButton
            title={LL.ReceiveScreen.regenerateInvoiceButtonTitle()}
            onPress={regenerateInvoiceFn}
          />
        </View>
      )
    }

    if (isPayCode && !canUsePayCode) {
      return (
        <View style={[styles.container, styles.cantUsePayCode, style]}>
          <Text type="p2" style={styles.cantUsePayCodeText}>
            {LL.ReceiveScreen.setUsernameToAcceptViaPaycode()}
          </Text>
          <GaloyTertiaryButton
            title={LL.ReceiveScreen.setUsernameButtonTitle()}
            onPress={toggleIsSetLightningAddressModalVisible}
          />
        </View>
      )
    }

    return null
  }

  return (
    <View style={styles.qr}>
      <GestureDetector gesture={displayingQR ? tapGesture : Gesture.Manual()}>
        <Animated.View style={animatedStyle}>{renderContent()}</Animated.View>
      </GestureDetector>
    </View>
  )
}

export const QRView = React.memo(QRViewBase)

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
