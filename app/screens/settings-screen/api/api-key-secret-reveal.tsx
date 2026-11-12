import * as React from "react"
import { Alert, Share, View } from "react-native"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { ActionField } from "@app/components/action-field"
import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { GaloyTertiaryButton } from "@app/components/atomic/galoy-tertiary-button"
import { headerBackControl } from "@app/components/header-back-control/header-back-control"
import { IconHero } from "@app/components/icon-hero"
import { Screen } from "@app/components/screen"
import { ScreenSecurityGate } from "@app/components/screen-security-gate"
import { QrCodeComponent } from "@app/components/totp-export"
import { useClipboard } from "@app/hooks"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { recordAppError } from "@app/utils/error-reporting"
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

/** The gate mounts this only once the screenshot guard is actually on — the secret,
 *  its QR and the Copy/Share actions must not exist while registration is pending.
 *  The dismissal guard lives in the wrapper below so it also covers the pending
 *  and failed states. */
const ApiKeySecretRevealContent: React.FC<
  Props & { onDone: () => void; onShownChange: (shown: boolean) => void }
> = ({ secret, name, onDone, onShownChange }) => {
  const { LL } = useI18nContext()
  const styles = useStyles()

  React.useEffect(() => {
    onShownChange(true)
    return () => onShownChange(false)
  }, [onShownChange])

  const {
    theme: { colors },
  } = useTheme()
  const { copyToClipboard } = useClipboard(CLIPBOARD_CLEAR_MS)

  const copySecret = () =>
    copyToClipboard({ content: secret, message: LL.ApiScreen.secretCopied() })

  const shareSecret = async () => {
    try {
      await Share.share({ message: secret })
    } catch (err) {
      if (err instanceof Error) {
        recordAppError(err)
        Alert.alert(err.message)
      }
    }
  }

  return (
    <Screen style={styles.container} preset="scroll">
      <View style={styles.body}>
        <IconHero
          icon="check-badge"
          iconColor={colors.staticSuccess}
          title={name}
          subtitle={LL.ApiScreen.secretWarning()}
        />

        <QrCodeComponent value={secret} />

        <View style={styles.secret}>
          <ActionField
            testID="api-key-secret"
            value={ellipsizeMiddle(secret, SECRET_PREVIEW)}
            icon="copy-paste"
            accessibilityLabel={LL.CopySecretComponent.button()}
            onAction={copySecret}
          />
        </View>

        <GaloyTertiaryButton
          {...testProps(LL.common.share())}
          clear
          title={LL.common.share()}
          icon={
            <View style={styles.shareIcon}>
              <GaloyIcon name="share" size={SHARE_ICON_SIZE} color={colors.accent} />
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
          onPress={onDone}
        />
      </View>
    </Screen>
  )
}

export const ApiKeySecretReveal: React.FC<Props> = (props) => {
  const { LL } = useI18nContext()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const allowLeaveRef = React.useRef(false)
  // True only while the gated content is mounted, which is only after the
  // screenshot guard is on. The header callback reads it at press time.
  const secretShownRef = React.useRef(false)
  const onShownChange = React.useCallback((shown: boolean) => {
    secretShownRef.current = shown
  }, [])

  const finish = React.useCallback(() => {
    allowLeaveRef.current = true
    navigation.goBack()
  }, [navigation])

  // The failure view's Back cannot be a plain goBack: it would pop the screen
  // and destroy the unrecoverable secret without a chance to copy it.
  const confirmDiscard = React.useCallback(() => {
    Alert.alert(LL.ApiScreen.discardSecretTitle(), LL.ApiScreen.discardSecretBody(), [
      { text: LL.common.cancel(), style: "cancel" },
      { text: LL.common.discard(), style: "destructive", onPress: finish },
    ])
  }, [LL, finish])

  // finish() sets allowLeave and pops immediately, so the header must not use it
  // until the secret is on screen. Until then it asks, the same as the gate's Back.
  const onHeaderBack = React.useCallback(() => {
    if (secretShownRef.current) finish()
    else confirmDiscard()
  }, [finish, confirmDiscard])

  // The dismissal guard is installed here, outside the gate: the one-time secret
  // already sits in the parent's state while registration is pending or failed,
  // so a back swipe must not pop the screen and silently destroy it.
  React.useEffect(() => {
    navigation.setOptions({
      title: LL.ApiScreen.keyCreatedTitle(),
      headerLeft: headerBackControl({ onPress: onHeaderBack }),
      gestureEnabled: false,
    })
  }, [navigation, LL, onHeaderBack])

  // gestureEnabled doesn't cover the Android system back
  // button — block every removal not initiated by Done, the header arrow or a confirmed discard
  React.useEffect(
    () =>
      navigation.addListener("beforeRemove", (e) => {
        if (!allowLeaveRef.current) e.preventDefault()
      }),
    [navigation],
  )

  return (
    <ScreenSecurityGate onBack={confirmDiscard}>
      <ApiKeySecretRevealContent
        {...props}
        onDone={finish}
        onShownChange={onShownChange}
      />
    </ScreenSecurityGate>
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
