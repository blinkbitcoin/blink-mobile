import React from "react"
import { View } from "react-native"

import { makeStyles, useTheme } from "@rn-vui/themed"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { CheckboxRow } from "@app/components/checkbox-row"
import { IconHero } from "@app/components/icon-hero"
import { InfoBanner } from "@app/components/info-banner"
import { PasswordInput } from "@app/components/password-input"
import { RichText } from "@app/components/rich-text"
import { Screen } from "@app/components/screen"
import { useI18nContext } from "@app/i18n/i18n-react"
import { testProps } from "@app/utils/testProps"

import { useCloudBackup, useCloudBackupForm } from "./hooks"
import { getCloudProviderName } from "./utils"

export const SparkCloudBackupScreen: React.FC = () => {
  const { LL } = useI18nContext()
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  const cloudProvider = getCloudProviderName(LL)

  const {
    isEncrypted,
    password,
    confirmPassword,
    toggleEncryption,
    setPassword,
    setConfirmPassword,
    passwordError,
    confirmPasswordError,
    isValid,
  } = useCloudBackupForm()

  const { handleBackup, loading } = useCloudBackup({ isEncrypted, password })

  return (
    <Screen preset="fixed">
      <View style={styles.container}>
        <View>
          <View style={styles.heroContainer}>
            <IconHero
              icon="cloud-arrow-up"
              iconColor={colors._green}
              title={LL.SparkOnboarding.CloudBackup.title()}
              subtitle={LL.SparkOnboarding.CloudBackup.description({
                provider: cloudProvider,
              })}
            />
          </View>

          <View style={styles.formContainer}>
            <CheckboxRow
              label={LL.SparkOnboarding.CloudBackup.encryptCheckbox()}
              isChecked={isEncrypted}
              onPress={toggleEncryption}
              centered
              {...testProps("encrypt-checkbox")}
            />

            {isEncrypted && (
              <View style={styles.encryptionFields}>
                <PasswordInput
                  label={LL.SparkOnboarding.CloudBackup.password()}
                  value={password}
                  onChangeText={setPassword}
                  placeholder={LL.SparkOnboarding.CloudBackup.passwordPlaceholder()}
                  error={passwordError}
                  {...testProps("cloud-password-input")}
                />
                <PasswordInput
                  label={LL.SparkOnboarding.CloudBackup.confirmPassword()}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder={LL.SparkOnboarding.CloudBackup.confirmPasswordPlaceholder()}
                  error={confirmPasswordError}
                  {...testProps("cloud-confirm-password-input")}
                />

                <InfoBanner
                  variant="warning"
                  title={LL.SparkOnboarding.CloudBackup.importantTitle()}
                  icon="info"
                >
                  <RichText
                    text={LL.SparkOnboarding.CloudBackup.importantMessage({
                      bold: LL.SparkOnboarding.CloudBackup.importantMessageBold(),
                    })}
                    bold={LL.SparkOnboarding.CloudBackup.importantMessageBold()}
                  />
                </InfoBanner>
              </View>
            )}
          </View>
        </View>

        <View style={styles.buttonsContainer}>
          <GaloyPrimaryButton
            title={LL.SparkOnboarding.CloudBackup.continueButton()}
            disabled={!isValid}
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
