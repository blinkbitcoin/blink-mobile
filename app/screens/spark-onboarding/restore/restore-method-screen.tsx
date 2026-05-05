import React, { useCallback } from "react"

import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import { useTheme } from "@rn-vui/themed"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { GaloySecondaryButton } from "@app/components/atomic/galoy-secondary-button"
import { IconHero } from "@app/components/icon-hero"
import { CredentialError, useCredentialBackup } from "@app/hooks"
import { useI18nContext } from "@app/i18n/i18n-react"
import { TranslationFunctions } from "@app/i18n/i18n-types"
import { PhraseStep, RootStackParamList } from "@app/navigation/stack-param-lists"
import { testProps } from "@app/utils/testProps"
import { toastShow } from "@app/utils/toast"

import { OnboardingScreenLayout } from "../layouts"
import { getCloudProviderName } from "../utils"

import { useRestoreWallet } from "./hooks/use-restore-wallet"

const showRestoreErrorToast = (
  error: CredentialError,
  LL: TranslationFunctions,
): void => {
  switch (error) {
    case CredentialError.UserCancelled:
      return
    case CredentialError.NoProvider:
    case CredentialError.Unsupported:
      toastShow({ message: LL.RestoreScreen.noBackupFound(), LL })
      return
    case CredentialError.Unknown:
      toastShow({ message: LL.RestoreScreen.restoreFailed(), LL })
      return
    default: {
      const _exhaustive: never = error
      throw new Error(`Unknown credential error: ${_exhaustive}`)
    }
  }
}

export const SparkRestoreMethodScreen: React.FC = () => {
  const { LL } = useI18nContext()
  const {
    theme: { colors },
  } = useTheme()
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()
  const { read, loading: credentialLoading } = useCredentialBackup()
  const { restore } = useRestoreWallet()
  const cloudProvider = getCloudProviderName(LL)

  const handleCredentialRestore = useCallback(async () => {
    const result = await read()
    if (!result.success) {
      showRestoreErrorToast(result.error, LL)
      return
    }
    await restore(result.mnemonic).catch(() => {})
  }, [read, restore, LL])

  return (
    <OnboardingScreenLayout
      footer={
        <>
          <GaloyPrimaryButton
            title={cloudProvider}
            onPress={() => navigation.navigate("sparkCloudRestoreScreen")}
            {...testProps("restore-cloud-button")}
          />
          <GaloySecondaryButton
            title={LL.BackupScreen.BackupMethod.passwordManager()}
            onPress={handleCredentialRestore}
            loading={credentialLoading}
            {...testProps("restore-credential-button")}
          />
          <GaloySecondaryButton
            title={LL.BackupScreen.BackupMethod.manualBackup()}
            onPress={() =>
              navigation.navigate("sparkRestorePhraseScreen", {
                step: PhraseStep.First,
              })
            }
            {...testProps("restore-manual-button")}
          />
        </>
      }
    >
      <IconHero
        icon="cloud"
        iconColor={colors.success}
        title={LL.RestoreScreen.title()}
        subtitle={LL.RestoreScreen.description()}
      />
    </OnboardingScreenLayout>
  )
}
