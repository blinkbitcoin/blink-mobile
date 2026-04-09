import React, { useEffect } from "react"
import { View } from "react-native"

import { Text, makeStyles, useTheme } from "@rn-vui/themed"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { GaloySecondaryButton } from "@app/components/atomic/galoy-secondary-button"
import { IconHero } from "@app/components/icon-hero"
import { Screen } from "@app/components/screen"
import { useI18nContext } from "@app/i18n/i18n-react"
import {
  MigrationCheckpoint,
  useMigrationCheckpoint,
} from "@app/screens/account-migration/hooks"
import { testProps } from "@app/utils/testProps"

import { useBackupMethods } from "./hooks"
import { getCloudProviderName } from "./utils"

export const SparkBackupMethodScreen: React.FC = () => {
  const { LL } = useI18nContext()
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  const { saveCheckpoint } = useMigrationCheckpoint()
  const {
    isCloudBackupAvailable,
    keychainLoading,
    handleKeychainBackup,
    handleCloudBackup,
    handleManualBackup,
  } = useBackupMethods()

  useEffect(() => {
    saveCheckpoint(MigrationCheckpoint.BackupMethod)
  }, [saveCheckpoint])

  const cloudProvider = getCloudProviderName(LL)

  return (
    <Screen preset="fixed">
      <View style={styles.container}>
        <IconHero
          icon="cloud"
          iconColor={colors.black}
          title={LL.SparkOnboarding.BackupMethod.title()}
          subtitle={LL.SparkOnboarding.BackupMethod.subtitle({
            provider: cloudProvider,
          })}
        />

        <View style={styles.buttonsContainer}>
          <GaloyPrimaryButton
            title={cloudProvider}
            onPress={handleCloudBackup}
            disabled={!isCloudBackupAvailable}
            {...testProps("backup-cloud-button")}
          />
          {!isCloudBackupAvailable && (
            <Text style={styles.comingSoonText}>
              {LL.SparkOnboarding.BackupMethod.iOSComingSoon()}
            </Text>
          )}
          <GaloySecondaryButton
            title={LL.SparkOnboarding.BackupMethod.passwordManager()}
            onPress={handleKeychainBackup}
            loading={keychainLoading}
            {...testProps("backup-keychain-button")}
          />
          <GaloySecondaryButton
            title={LL.SparkOnboarding.BackupMethod.manualBackup()}
            onPress={handleManualBackup}
            {...testProps("backup-manual-button")}
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
  comingSoonText: {
    textAlign: "center",
  },
}))
