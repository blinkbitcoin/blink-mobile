import React, { useCallback, useState } from "react"

import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { GaloySecondaryButton } from "@app/components/atomic/galoy-secondary-button"
import { IconHero } from "@app/components/icon-hero"
import { getSparkKeychainService } from "@app/config/appinfo"
import { useAppConfig, useKeychainBackup } from "@app/hooks"
import { useI18nContext } from "@app/i18n/i18n-react"
import { PhraseStep, RootStackParamList } from "@app/navigation/stack-param-lists"
import { testProps } from "@app/utils/testProps"
import { toastShow } from "@app/utils/toast"

import { OnboardingScreenLayout } from "../layouts"
import { getCloudProviderName } from "../utils"

import { useRestoreWallet } from "./hooks/use-restore-wallet"

export const SparkRestoreMethodScreen: React.FC = () => {
  const { LL } = useI18nContext()
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()
  const { appConfig } = useAppConfig()
  const { read: readKeychain, loading: keychainLoading } = useKeychainBackup(
    getSparkKeychainService(appConfig.galoyInstance.name),
  )
  const { restore } = useRestoreWallet()
  const [keychainError, setKeychainError] = useState(false)
  const cloudProvider = getCloudProviderName(LL)

  const handleKeychainRestore = useCallback(async () => {
    setKeychainError(false)
    const mnemonic = await readKeychain()
    if (!mnemonic) {
      setKeychainError(true)
      toastShow({ message: LL.RestoreScreen.noBackupFound(), LL })
      return
    }
    await restore(mnemonic).catch(() => {})
  }, [readKeychain, restore, LL])

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
            onPress={handleKeychainRestore}
            loading={keychainLoading}
            {...testProps("restore-keychain-button")}
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
        iconColor={colors.black}
        title={LL.RestoreScreen.title()}
        subtitle={LL.RestoreScreen.description()}
      />
      {keychainError && (
        <Text style={styles.errorText}>{LL.RestoreScreen.noBackupFound()}</Text>
      )}
    </OnboardingScreenLayout>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  errorText: {
    textAlign: "center",
    color: colors.red,
    fontSize: 14,
    marginTop: 12,
  },
}))
