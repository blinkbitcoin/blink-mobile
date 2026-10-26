import React, { useCallback } from "react"
import { Platform, View } from "react-native"
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { SettingItemRow } from "@app/components/card-screen"
import { IconHero } from "@app/components/icon-hero"
import { StepLayout } from "@app/components/step-layout"
import { CopySecretComponent } from "@app/components/totp-export"
import { useScreenSecurity } from "@app/hooks/use-screen-security"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { useHardwareBackGuard } from "@app/screens/account-migration/hooks/use-hardware-back-guard"
import { testProps } from "@app/utils/testProps"

import { useSetupKeyBackup } from "./hooks/use-setup-key-backup"

const OPTION_ICON_SIZE = 20

/**
 * Follows a valid code: the authenticator is already on, and this is the one chance to
 * keep its setup key somewhere other than this phone. Every option is optional, and I've
 * saved it moves on whether or not one was used.
 */
export const SetupKeyBackupScreen: React.FC = () => {
  /** The key is on screen: no screenshot, recording or app-switcher snapshot of it. */
  useScreenSecurity()
  /** The one chance to keep the key: the system back, an edge swipe away with gesture
   *  navigation, does nothing here, as the iOS swipe does not. The header's arrow still
   *  leaves. */
  useHardwareBackGuard(undefined)
  const { LL } = useI18nContext()
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const navigation =
    useNavigation<
      NativeStackNavigationProp<RootStackParamList, "totpRegistrationBackup">
    >()
  const { params } = useRoute<RouteProp<RootStackParamList, "totpRegistrationBackup">>()
  const { saveToPasswordManager, reportManualCopy } = useSetupKeyBackup(params)
  /** As the self-custodial backup offers it: iOS has no API that raises its save sheet. */
  const isNonIosPlatform = Platform.OS !== "ios"

  /** The done screen takes this one's place: once the user says the key is kept, no way
   *  back from there shows it again. */
  const handleSaved = useCallback(() => {
    navigation.replace("totpRegistrationDone")
  }, [navigation])

  return (
    <StepLayout
      footer={
        <GaloyPrimaryButton
          title={LL.AuthenticatorOnboarding.savedIt()}
          onPress={handleSaved}
          {...testProps("setup-key-backup-saved")}
        />
      }
    >
      <IconHero
        icon="key-outline"
        iconColor={colors._green}
        title={LL.AuthenticatorOnboarding.backupTitle()}
        subtitle={
          <Text type="p3" style={styles.description}>
            {LL.AuthenticatorOnboarding.backupDescription()}
          </Text>
        }
      />
      <View style={styles.body}>
        {isNonIosPlatform && (
          <View style={styles.option}>
            <SettingItemRow
              leftIcon="key-outline"
              leftIconSize={OPTION_ICON_SIZE}
              title={LL.AuthenticatorOnboarding.saveToPasswordManager()}
              onPress={saveToPasswordManager}
            />
          </View>
        )}
        <View style={styles.manualCopy}>
          <Text type="p3" style={styles.manualCopyLabel}>
            {LL.AuthenticatorOnboarding.copyForManualBackup()}
          </Text>
          <CopySecretComponent secret={params.secret} onCopy={reportManualCopy} />
        </View>
      </View>
    </StepLayout>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  description: {
    color: colors.grey1,
    textAlign: "center",
  },
  body: {
    marginTop: 30,
    marginHorizontal: 20,
    gap: 20,
  },
  /** The card's surface sits behind the row, so the row's own pressed shade shows. */
  option: {
    backgroundColor: colors.grey5,
    borderRadius: 8,
    overflow: "hidden",
  },
  manualCopy: {
    gap: 3,
  },
  manualCopyLabel: {
    color: colors.black,
    lineHeight: 20,
  },
}))
