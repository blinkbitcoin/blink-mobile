import * as React from "react"
import { Alert, Share, TouchableOpacity, View } from "react-native"
import crashlytics from "@react-native-firebase/crashlytics"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { GaloySecondaryButton } from "@app/components/atomic/galoy-secondary-button"
import { Screen } from "@app/components/screen"
import { QrCodeComponent } from "@app/components/totp-export"
import { useClipboard } from "@app/hooks"
import { useScreenSecurity } from "@app/hooks/use-screen-security"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { testProps } from "@app/utils/testProps"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

const CLIPBOARD_CLEAR_MS = 60_000

type Props = {
  secret: string
  name: string
}

export const ApiKeySecretReveal: React.FC<Props> = ({ secret, name }) => {
  useScreenSecurity()

  const { LL } = useI18nContext()
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { copyToClipboard } = useClipboard(CLIPBOARD_CLEAR_MS)
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const allowLeaveRef = React.useRef(false)

  React.useEffect(() => {
    navigation.setOptions({
      title: LL.ApiScreen.keyCreatedTitle(),
      headerBackVisible: false,
      gestureEnabled: false,
    })
  }, [navigation, LL])

  // headerBackVisible/gestureEnabled don't cover the Android system back
  // button — block every removal not initiated by the Done button so the
  // one-time secret can't be dismissed accidentally
  React.useEffect(
    () =>
      navigation.addListener("beforeRemove", (e) => {
        if (!allowLeaveRef.current) e.preventDefault()
      }),
    [navigation],
  )

  const finish = () => {
    allowLeaveRef.current = true
    navigation.goBack()
  }

  const copySecret = () =>
    copyToClipboard({ content: secret, message: LL.ApiScreen.secretCopied() })

  const shareSecret = async () => {
    try {
      await Share.share({ message: secret })
    } catch (err) {
      if (err instanceof Error) {
        crashlytics().recordError(err)
        Alert.alert(err.message)
      }
    }
  }

  return (
    <Screen style={styles.container} preset="scroll">
      <View style={styles.header}>
        <GaloyIcon name="check-circle" size={40} color={colors.primary} />
        <Text type="p1" style={styles.name}>
          {name}
        </Text>
        <Text type="p3" color={colors.grey2} style={styles.warning}>
          {LL.ApiScreen.secretWarning()}
        </Text>
      </View>

      <View style={styles.qrContainer}>
        <QrCodeComponent value={secret} />
      </View>

      <TouchableOpacity
        {...testProps("api-key-secret")}
        style={styles.secretContainer}
        onPress={copySecret}
        activeOpacity={0.7}
      >
        <Text
          type="p2"
          style={styles.secretText}
          numberOfLines={1}
          ellipsizeMode="middle"
        >
          {secret}
        </Text>
        <GaloyIcon name="copy-paste" size={20} color={colors.primary} />
      </TouchableOpacity>

      <GaloySecondaryButton
        {...testProps(LL.common.share())}
        title={LL.common.share()}
        iconName="share"
        onPress={shareSecret}
      />

      <View style={styles.buttonsContainer}>
        <GaloyPrimaryButton
          {...testProps(LL.ApiScreen.done())}
          title={LL.ApiScreen.done()}
          onPress={finish}
        />
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  container: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    flexGrow: 1,
  },
  header: {
    alignItems: "center",
    rowGap: 8,
  },
  name: {
    fontWeight: "bold",
  },
  warning: {
    textAlign: "center",
  },
  qrContainer: {
    alignItems: "center",
    marginVertical: 20,
  },
  secretContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 8,
    gap: 12,
    backgroundColor: colors.grey5,
    marginBottom: 16,
  },
  secretText: {
    flex: 1,
    fontFamily: "monospace",
    letterSpacing: 0.5,
    color: colors.grey0,
  },
  buttonsContainer: {
    flex: 1,
    justifyContent: "flex-end",
    marginTop: 20,
    paddingBottom: 20,
  },
}))
