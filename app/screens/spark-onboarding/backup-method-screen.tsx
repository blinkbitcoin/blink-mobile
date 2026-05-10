import React, { useEffect } from "react"

import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { GaloySecondaryButton } from "@app/components/atomic/galoy-secondary-button"
import { IconHero } from "@app/components/icon-hero"
import { useI18nContext } from "@app/i18n/i18n-react"
import {
  MigrationCheckpoint,
  useMigrationCheckpoint,
} from "@app/screens/account-migration/hooks"
import { testProps } from "@app/utils/testProps"

import { useBackupMethods } from "./hooks"
import { OnboardingScreenLayout } from "./layouts"
import { getCloudProviderName } from "./utils"

export const SparkBackupMethodScreen: React.FC = () => {
  const { LL } = useI18nContext()
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  const { saveCheckpoint } = useMigrationCheckpoint()
  const {
    isDriveBackupAvailable,
    isCredentialBackupAvailable,
    credentialLoading,
    handleCredentialBackup,
    handleCloudBackup,
    handleManualBackup,
  } = useBackupMethods()

  useEffect(() => {
    saveCheckpoint(MigrationCheckpoint.BackupMethod)
  }, [saveCheckpoint])

  const cloudProvider = getCloudProviderName(LL)

  return (
    <OnboardingScreenLayout
      footer={
        <>
          <GaloyPrimaryButton
            title={cloudProvider}
            onPress={handleCloudBackup}
            disabled={!isDriveBackupAvailable}
            {...testProps("backup-cloud-button")}
          />
          {!isDriveBackupAvailable && (
            <Text style={styles.comingSoonText}>
              {LL.BackupScreen.BackupMethod.iOSComingSoon()}
            </Text>
          )}
          {isCredentialBackupAvailable && (
            <GaloySecondaryButton
              title={LL.BackupScreen.BackupMethod.passwordManager()}
              onPress={handleCredentialBackup}
              loading={credentialLoading}
              {...testProps("backup-credential-button")}
            />
          )}
          <GaloySecondaryButton
            title={LL.BackupScreen.BackupMethod.manualBackup()}
            onPress={handleManualBackup}
            {...testProps("backup-manual-button")}
          />
        </>
      }
    >
      <IconHero
        icon="cloud"
        iconColor={colors.success}
        title={LL.BackupScreen.BackupMethod.title()}
        subtitle={LL.BackupScreen.BackupMethod.subtitle({ provider: cloudProvider })}
      />
    </OnboardingScreenLayout>
  )
}

const useStyles = makeStyles(() => ({
  comingSoonText: {
    textAlign: "center",
  },
}))
