import React, { useMemo } from "react"
import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import { useTheme } from "@rn-vui/themed"

import { RichText } from "@app/components/rich-text"
import { useRemoteConfig } from "@app/config/feature-flags-context"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { openExternalUrl } from "@app/utils/external"

import { MigrationExplainerLayout } from "../migration-explainer-layout"

export const SparkMigrationExplainerScreen: React.FC = () => {
  const { LL } = useI18nContext()
  const {
    theme: { colors },
  } = useTheme()
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()
  const { sparkCompatibleWalletsUrl } = useRemoteConfig()

  const steps: ReadonlyArray<React.ReactNode> = useMemo(
    () => [
      <RichText
        key="step1"
        text={LL.AccountMigration.explainerStep1()}
        tags={{
          link: { onPress: () => openExternalUrl(sparkCompatibleWalletsUrl) },
        }}
      />,
      LL.AccountMigration.explainerStep2(),
      LL.AccountMigration.explainerStep3(),
    ],
    [LL, sparkCompatibleWalletsUrl],
  )

  return (
    <MigrationExplainerLayout
      icon="key-outline"
      iconColor={colors.grey3}
      title={LL.AccountMigration.explainerTitle()}
      steps={steps}
      ctaTitle={LL.AccountMigration.letsMove()}
      onCtaPress={() => navigation.navigate("selfCustodialBackupMethod")}
    />
  )
}
