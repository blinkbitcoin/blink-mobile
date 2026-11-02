import React from "react"
import { View } from "react-native"

import { makeStyles, useTheme } from "@rn-vui/themed"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { IconHero } from "@app/components/icon-hero"
import { InfoBanner } from "@app/components/info-banner"
import { PasswordInput } from "@app/components/password-input"
import { RichText } from "@app/components/rich-text"
import { Screen } from "@app/components/screen"
import { useScreenSecurity } from "@app/hooks/use-screen-security"
import { useI18nContext } from "@app/i18n/i18n-react"
import {
  MigrationCheckpoint,
  useMigrationBackupCheckpoint,
} from "@app/screens/account-migration/hooks"
import { testProps } from "@app/utils/testProps"

import { useCloudBackup, useCloudBackupForm } from "./hooks"
import { getCloudProviderName } from "./utils"

export const CloudBackupScreen: React.FC = () => {
  const { LL } = useI18nContext()
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  const cloudProvider = getCloudProviderName(LL)

  // The encryption password is typed here, and PasswordInput's eye toggle shows it in
  // plain text. Guarded from mount, so the first keystroke never lands on an
  // unguarded frame.
  useScreenSecurity()

  const {
    password,
    confirmPassword,
    setPassword,
    setConfirmPassword,
    markPasswordTouched,
    markConfirmPasswordTouched,
    passwordError,
    confirmPasswordError,
    isValid,
  } = useCloudBackupForm()

  const { handleBackup, loading } = useCloudBackup({ password })

  useMigrationBackupCheckpoint(MigrationCheckpoint.CloudBackup)

  /** The backup commits the passphrase it was started with, so it stays put
   *  while it runs. */
  const isContinueDisabled = !isValid || loading

  return (
    <Screen preset="fixed">
      <View style={styles.container}>
        <View>
          <View style={styles.heroContainer}>
            <IconHero
              icon="cloud"
              iconColor={colors._green}
              title={LL.BackupScreen.CloudBackup.title()}
              subtitle={LL.BackupScreen.CloudBackup.description({
                provider: cloudProvider,
              })}
            />
          </View>

          <View style={styles.formContainer}>
            <View style={styles.encryptionFields}>
              <PasswordInput
                label={LL.BackupScreen.CloudBackup.password()}
                value={password}
                onChangeText={setPassword}
                onBlur={markPasswordTouched}
                placeholder={LL.BackupScreen.CloudBackup.passwordPlaceholder()}
                error={passwordError}
                disabled={loading}
                {...testProps("cloud-password-input")}
              />
              <PasswordInput
                label={LL.BackupScreen.CloudBackup.confirmPassword()}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                onBlur={markConfirmPasswordTouched}
                placeholder={LL.BackupScreen.CloudBackup.confirmPasswordPlaceholder()}
                error={confirmPasswordError}
                disabled={loading}
                {...testProps("cloud-confirm-password-input")}
              />

              <InfoBanner
                title={LL.BackupScreen.CloudBackup.importantTitle()}
                icon="warning"
                iconColor="warning"
              >
                <RichText
                  text={LL.BackupScreen.CloudBackup.importantMessage({
                    bold: `<bold>${LL.BackupScreen.CloudBackup.importantMessageBold()}</bold>`,
                  })}
                />
              </InfoBanner>
            </View>
          </View>
        </View>

        <View style={styles.buttonsContainer}>
          <GaloyPrimaryButton
            title={LL.BackupScreen.CloudBackup.continueButton()}
            disabled={isContinueDisabled}
            loading={loading}
            onPress={handleBackup}
            {...testProps("cloud-backup-continue")}
          />
        </View>
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(() => ({
  container: {
    flex: 1,
    justifyContent: "space-between",
  },
  heroContainer: {
    paddingBottom: 20,
  },
  formContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 14,
    alignItems: "center",
  },
  encryptionFields: {
    gap: 0,
    alignSelf: "stretch",
  },
  buttonsContainer: {
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 10,
  },
}))
