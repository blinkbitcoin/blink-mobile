import React, { useCallback } from "react"
import { Platform } from "react-native"

import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { useTheme } from "@rn-vui/themed"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { GaloySecondaryButton } from "@app/components/atomic/galoy-secondary-button"
import { IconHero } from "@app/components/icon-hero"
import { useI18nContext } from "@app/i18n/i18n-react"
import { TranslationFunctions } from "@app/i18n/i18n-types"
import { PhraseStep, RootStackParamList } from "@app/navigation/stack-param-lists"
import { reportError } from "@app/utils/error-logging"
import { testProps } from "@app/utils/testProps"
import { toastShow } from "@app/utils/toast"

import { CredentialError, useCredentialBackup } from "../hooks"
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
      /** Compile-time exhaustiveness stays, but the native module can return an error
       *  string no CredentialError models; a runtime throw here reached the un-awaited
       *  onPress as an unhandled promise rejection, so report and toast instead. */
      const _exhaustive: never = error
      reportError(
        "Restore credential error unhandled",
        new Error(`Unknown credential error: ${_exhaustive}`),
        { alwaysRecord: true },
      )
      toastShow({ message: LL.RestoreScreen.restoreFailed(), LL })
    }
  }
}

export const RestoreMethodScreen: React.FC = () => {
  const { LL } = useI18nContext()
  const {
    theme: { colors },
  } = useTheme()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const { read, loading: credentialLoading } = useCredentialBackup()
  const { restore } = useRestoreWallet()
  const cloudProvider = getCloudProviderName(LL)

  /** read() itself can reject (native module failure); this handler is wired straight to
   *  onPress, so a rejection here would be unhandled — catch, report, and toast. */
  const handleCredentialRestore = useCallback(async () => {
    try {
      const result = await read()
      if (!result.success) {
        showRestoreErrorToast(result.error, LL)
        return
      }
      await restore(result.mnemonic).catch(() => {})
    } catch (err) {
      reportError("Restore credential read", err)
      toastShow({ message: LL.RestoreScreen.restoreFailed(), LL })
    }
  }, [read, restore, LL])

  return (
    <OnboardingScreenLayout
      footer={
        <>
          <GaloyPrimaryButton
            title={cloudProvider}
            onPress={() => navigation.navigate("selfCustodialCloudRestore")}
            {...testProps("restore-cloud-button")}
          />
          {/* TODO: disabled on iOS while credential-based restore integration is completed */}
          {Platform.OS !== "ios" && (
            <GaloySecondaryButton
              title={LL.BackupScreen.BackupMethod.passwordManager()}
              onPress={handleCredentialRestore}
              loading={credentialLoading}
              {...testProps("restore-credential-button")}
            />
          )}
          <GaloySecondaryButton
            title={LL.BackupScreen.BackupMethod.manualBackup()}
            onPress={() =>
              navigation.navigate("selfCustodialRestorePhrase", {
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
        iconColor={colors._green}
        title={LL.RestoreScreen.title()}
        subtitle={LL.RestoreScreen.description()}
      />
    </OnboardingScreenLayout>
  )
}
