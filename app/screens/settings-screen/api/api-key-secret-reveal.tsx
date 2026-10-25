import * as React from "react"
import { Alert, Share, View } from "react-native"
import crashlytics from "@react-native-firebase/crashlytics"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { ActionField } from "@app/components/action-field"
import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { GaloyTertiaryButton } from "@app/components/atomic/galoy-tertiary-button"
import { headerBackControl } from "@app/components/header-back-control/header-back-control"
import { IconHero } from "@app/components/icon-hero"
import { Screen } from "@app/components/screen"
import { QrCodeComponent } from "@app/components/totp-export"
import { useClipboard } from "@app/hooks"
import { useScreenSecurity } from "@app/hooks/use-screen-security"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { ellipsizeMiddle } from "@app/utils/helper"
import { testProps } from "@app/utils/testProps"
import { makeStyles, useTheme } from "@rn-vui/themed"

const CLIPBOARD_CLEAR_MS = 60_000
const SHARE_ICON_SIZE = 16
const SHARE_HIT_SLOP = { top: 8, bottom: 8, left: 20, right: 20 }
/** Both ends of the key stay readable, as on the design: blink_dHWO28fQO...3JU4Nc49C */
const SECRET_PREVIEW = { maxLength: 30, maxResultLeft: 15, maxResultRight: 9 }

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

  const finish = React.useCallback(() => {
    allowLeaveRef.current = true
    navigation.goBack()
  }, [navigation])

  // the header back arrow takes the same exit as Done; only the swipe and the
  // system back stay blocked
  React.useEffect(() => {
    navigation.setOptions({
      title: LL.ApiScreen.keyCreatedTitle(),
      headerLeft: headerBackControl({ onPress: finish }),
      gestureEnabled: false,
    })
  }, [navigation, LL, finish])

  // gestureEnabled doesn't cover the Android system back button — block every
  // removal not initiated by Done or the header arrow so the one-time secret
  // can't be dismissed accidentally
  React.useEffect(
    () =>
      navigation.addListener("beforeRemove", (e) => {
        if (!allowLeaveRef.current) e.preventDefault()
      }),
    [navigation],
  )

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
      <View style={styles.body}>
        <IconHero
          icon="check-badge"
          iconColor={colors._green}
          title={name}
          subtitle={LL.ApiScreen.secretWarning()}
        />

        <QrCodeComponent value={secret} />

        <View style={styles.secret}>
          <ActionField
            testID="api-key-secret"
            value={ellipsizeMiddle(secret, SECRET_PREVIEW)}
            icon="copy-paste"
            onAction={copySecret}
          />
        </View>

        <GaloyTertiaryButton
          {...testProps(LL.common.share())}
          clear
          title={LL.common.share()}
          icon={
            <View style={styles.shareIcon}>
              <GaloyIcon name="share" size={SHARE_ICON_SIZE} color={colors.primary} />
            </View>
          }
          hitSlop={SHARE_HIT_SLOP}
          onPress={shareSecret}
        />
      </View>

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

const useStyles = makeStyles(() => ({
  container: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    flexGrow: 1,
  },
  body: {
    alignItems: "center",
    rowGap: 14,
  },
  secret: {
    alignSelf: "stretch",
  },
  shareIcon: {
    marginLeft: 8,
  },
  buttonsContainer: {
    flex: 1,
    justifyContent: "flex-end",
    marginTop: 20,
  },
}))
