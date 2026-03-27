import React from "react"
import { View } from "react-native"

import { Text, makeStyles, useTheme } from "@rn-vui/themed"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { CheckboxRow } from "@app/components/checkbox-row"
import { IconHero } from "@app/components/icon-hero"
import { PasswordInput } from "@app/components/password-input"
import { Screen } from "@app/components/screen"
import { useI18nContext } from "@app/i18n/i18n-react"

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
            />

            {isEncrypted && (
              <View style={styles.encryptionFields}>
                <PasswordInput
                  label={LL.SparkOnboarding.CloudBackup.password()}
                  value={password}
                  onChangeText={setPassword}
                  placeholder={LL.SparkOnboarding.CloudBackup.passwordPlaceholder()}
                  error={passwordError}
                />
                <PasswordInput
                  label={LL.SparkOnboarding.CloudBackup.confirmPassword()}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder={LL.SparkOnboarding.CloudBackup.confirmPasswordPlaceholder()}
                  error={confirmPasswordError}
                />

                <View style={styles.warningCard}>
                  <View style={styles.warningHeader}>
                    <GaloyIcon name="info" size={16} color={colors.primary} />
                    <Text style={styles.warningTitle}>
                      {LL.SparkOnboarding.CloudBackup.importantTitle()}
                    </Text>
                  </View>
                  {(() => {
                    const boldText = LL.SparkOnboarding.CloudBackup.importantMessageBold()
                    const fullText = LL.SparkOnboarding.CloudBackup.importantMessage({
                      bold: boldText,
                    })
                    const [before, after] = fullText.split(boldText)
                    return (
                      <Text style={styles.warningBody}>
                        {before}
                        <Text style={styles.warningBold}>{boldText}</Text>
                        {after}
                      </Text>
                    )
                  })()}
                </View>
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
          />
        </View>
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors }) => ({
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
  warningCard: {
    backgroundColor: colors.grey5,
    borderRadius: 8,
    padding: 14,
    gap: 14,
  },
  warningHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 3,
  },
  warningTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "700",
    color: colors.primary,
  },
  warningBody: {
    fontSize: 16,
    lineHeight: 22,
    color: colors.grey2,
  },
  warningBold: {
    fontWeight: "700",
    fontSize: 16,
    lineHeight: 22,
    color: colors.grey2,
  },
  buttonsContainer: {
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 10,
  },
}))
