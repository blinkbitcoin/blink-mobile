import Clipboard from "@react-native-clipboard/clipboard"
import { StackNavigationProp } from "@react-navigation/stack"
import LottieView from "lottie-react-native"
import * as React from "react"
import { useCallback, useMemo } from "react"
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  Share,
  Text,
  View,
} from "react-native"
import { Button } from "react-native-elements"
import EStyleSheet from "react-native-extended-stylesheet"
import QRCode from "react-native-qrcode-svg"
import Toast from "react-native-root-toast"
import Icon from "react-native-vector-icons/Ionicons"
import { translate } from "../../i18n"
import { MoveMoneyStackParamList } from "../../navigation/stack-param-lists"
import { palette } from "../../theme/palette"
import {
  getFullUri as getFullUriUtil,
  TYPE_LIGHTNING,
  TYPE_BITCOIN,
} from "../../utils/wallet"

import successLottie from "../send-bitcoin-screen/success_lottie.json"

const configByType = {
  [TYPE_LIGHTNING]: {
    copyToClipboardLabel: "ReceiveBitcoinScreen.copyClipboard",
    shareButtonLabel: "common.shareLightning",
    ecl: "L" as const,
    icon: "flash",
  },
  [TYPE_BITCOIN]: {
    copyToClipboardLabel: "ReceiveBitcoinScreen.copyClipboardBitcoin",
    shareButtonLabel: "common.shareBitcoin",
    ecl: "M" as const,
    icon: "logo-bitcoin",
  },
}

type Props = {
  data: string
  type: GetFullUriInput["type"]
  amount: GetFullUriInput["amount"]
  memo: GetFullUriInput["memo"]
  loading: boolean
  completed: boolean
  navigation: StackNavigationProp<MoveMoneyStackParamList, "receiveBitcoin">
  err: string
}

export const QRView = ({
  data,
  type,
  amount,
  memo,
  loading,
  completed,
  navigation,
  err,
}: Props): JSX.Element => {
  const isReady = !err && (type === TYPE_LIGHTNING ? !loading && data !== "" : true)

  const getFullUri = useCallback(
    ({ input, uppercase = false, prefix = true }) =>
      getFullUriUtil({ type, amount, memo, input, uppercase, prefix }),
    [type, amount, memo],
  )

  const copyToClipboard = useCallback(() => {
    Clipboard.setString(getFullUri({ input: data, prefix: false }))

    if (Platform.OS === "ios") {
      const stringToShow = configByType[type].copyToClipboardLabel

      Toast.show(translate(stringToShow), {
        duration: Toast.durations.LONG,
        shadow: false,
        animation: true,
        hideOnPress: true,
        delay: 0,
        position: -100,
        opacity: 0.5,
      })
    }
  }, [data, getFullUri, type])

  const share = useCallback(async () => {
    try {
      const result = await Share.share({
        message: getFullUri({ input: data, prefix: false }),
      })

      if (result.action === Share.sharedAction) {
        if (result.activityType) {
          // shared with activity type of result.activityType
        } else {
          // shared
        }
      } else if (result.action === Share.dismissedAction) {
        // dismissed
      }
    } catch (error) {
      Alert.alert(error.message)
    }
  }, [data, getFullUri])

  const dataOneLiner = useCallback(() => {
    if (type === TYPE_LIGHTNING) {
      return data ? `${data.substr(0, 18)}...${data.substr(-18)}` : ""
    }
    return data
  }, [data, type])

  const renderActionLabel = useMemo(() => {
    if (completed) {
      return (
        <Text style={styles.completedText}>
          {translate("ReceiveBitcoinScreen.invoicePaid")}
        </Text>
      )
    }

    if (isReady) {
      return (
        <Pressable onPress={copyToClipboard}>
          <Text style={styles.completedText}>
            {translate("ReceiveBitcoinScreen.tapQrCodeCopy")}
          </Text>
        </Pressable>
      )
    }

    return <Text> </Text>
  }, [completed, isReady, copyToClipboard])

  const renderSuccessView = useMemo(() => {
    if (completed) {
      return (
        <LottieView
          source={successLottie}
          loop={false}
          autoPlay
          style={styles.lottie}
          resizeMode="cover"
        />
      )
    }
    return null
  }, [completed])

  const renderQRCode = useMemo(() => {
    if (!completed && isReady) {
      return (
        <Pressable onPress={copyToClipboard}>
          <QRCode
            size={280}
            value={getFullUri({ input: data, uppercase: true })}
            logoBackgroundColor="white"
            ecl={configByType[type].ecl}
            // __DEV__ workaround for https://github.com/facebook/react-native/issues/26705
            logo={
              // !__DEV__ &&
              Icon.getImageSourceSync(configByType[type].icon, 28, palette.orange)
            }
          />
        </Pressable>
      )
    }
    return null
  }, [copyToClipboard, data, getFullUri, isReady, completed, type])

  const renderStatusView = useMemo(() => {
    if (!completed && !isReady) {
      return (
        <View style={styles.errorContainer}>
          {(err !== "" && (
            // eslint-disable-next-line react-native/no-inline-styles
            <Text style={{ color: palette.red, alignSelf: "center" }} selectable>
              {err}
            </Text>
          )) || <ActivityIndicator size="large" color={palette.blue} />}
        </View>
      )
    }
    return null
  }, [err, isReady, completed])

  return (
    <>
      <View style={styles.qr}>
        {renderSuccessView}
        {renderQRCode}
        {renderStatusView}
        <Pressable onPress={copyToClipboard}>
          <Text style={styles.copyToClipboardText}>{dataOneLiner()}</Text>
        </Pressable>
        {renderActionLabel}
      </View>
      <Button
        buttonStyle={styles.buttonStyle}
        containerStyle={styles.buttonContainer}
        title={
          completed
            ? translate("common.ok")
            : translate(configByType[type].shareButtonLabel)
        }
        onPress={completed ? () => navigation.goBack() : share}
        disabled={!isReady}
        titleStyle={styles.buttonTitle}
      />
    </>
  )
}

const styles = EStyleSheet.create({
  buttonContainer: { marginHorizontal: 52, paddingVertical: 18 },

  buttonStyle: {
    backgroundColor: palette.lightBlue,
    borderRadius: 32,
  },

  buttonTitle: {
    fontWeight: "bold",
  },

  completedText: {
    color: palette.darkGrey,
  },

  copyToClipboardText: { color: palette.darkGrey, textAlign: "center" },

  errorContainer: {
    alignContent: "center",
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: palette.white,
    height: 280,
    justifyContent: "center",
    width: 280,
  },

  lottie: {
    height: "200rem",
    width: "200rem",
  },

  qr: {
    alignItems: "center",
  },
})

export default React.memo(QRView)
