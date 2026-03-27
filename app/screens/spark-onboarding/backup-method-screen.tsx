import React from "react"
import { View } from "react-native"

import { makeStyles, useTheme } from "@rn-vui/themed"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { GaloySecondaryButton } from "@app/components/atomic/galoy-secondary-button"
import { IconHero } from "@app/components/icon-hero"
import { Screen } from "@app/components/screen"
import { useI18nContext } from "@app/i18n/i18n-react"

import { useBackupMethods } from "./hooks"
import { getCloudProviderName } from "./utils"

export const SparkBackupMethodScreen: React.FC = () => {
  const { LL } = useI18nContext()
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  const { keychainLoading, handleKeychainBackup, handleCloudBackup, handleManualBackup } =
    useBackupMethods()

  const cloudProvider = getCloudProviderName(LL)

  return (
    <Screen preset="fixed">
      <View style={styles.container}>
        <IconHero
          icon="cloud-arrow-up"
          iconColor={colors._green}
          title={LL.SparkOnboarding.BackupMethod.title()}
          subtitle={LL.SparkOnboarding.BackupMethod.subtitle({
            provider: cloudProvider,
          })}
        />

        <View style={styles.buttonsContainer}>
          <GaloyPrimaryButton title={cloudProvider} onPress={handleCloudBackup} />
          <GaloySecondaryButton
            title={LL.SparkOnboarding.BackupMethod.passwordManager()}
            onPress={handleKeychainBackup}
            loading={keychainLoading}
          />
          <GaloySecondaryButton
            title={LL.SparkOnboarding.BackupMethod.manualBackup()}
            onPress={handleManualBackup}
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
  buttonsContainer: {
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 10,
  },
}))
