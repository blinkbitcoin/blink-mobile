import React from "react"
import { Platform } from "react-native"

import { useTheme } from "@rn-vui/themed"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { GaloySecondaryButton } from "@app/components/atomic/galoy-secondary-button"
import { IconHero } from "@app/components/icon-hero"
import { useI18nContext } from "@app/i18n/i18n-react"
import { testProps } from "@app/utils/testProps"

import {
  MigrationCheckpoint,
  useMigrationBackupCheckpoint,
} from "../../account-migration/hooks"

import { useBackupMethods } from "./hooks"
import { OnboardingScreenLayout } from "./layouts"
import { getCloudProviderName } from "./utils"

export const BackupMethodScreen: React.FC = () => {
  const { LL } = useI18nContext()
  const {
    theme: { colors },
  } = useTheme()

  const {
    isCredentialBackupAvailable,
    credentialLoading,
    handleCredentialBackup,
    handleCloudBackup,
    handleManualBackup,
  } = useBackupMethods()

  useMigrationBackupCheckpoint(MigrationCheckpoint.BackupMethod)

  const cloudProvider = getCloudProviderName(LL)

  return (
    <OnboardingScreenLayout
      footer={
        <>
          <GaloyPrimaryButton
            title={cloudProvider}
            onPress={handleCloudBackup}
            {...testProps("backup-cloud-button")}
          />
          {/* TODO: disabled on iOS while credential-based backup integration is completed */}
          {Platform.OS !== "ios" && isCredentialBackupAvailable && (
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
        iconColor={colors._green}
        title={LL.BackupScreen.BackupMethod.title()}
        subtitle={LL.BackupScreen.BackupMethod.subtitle({ provider: cloudProvider })}
      />
    </OnboardingScreenLayout>
  )
}
