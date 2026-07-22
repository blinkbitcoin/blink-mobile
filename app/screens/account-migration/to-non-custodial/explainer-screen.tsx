import React, { useCallback, useState } from "react"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { useTheme } from "@rn-vui/themed"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { IconHero } from "@app/components/icon-hero"
import { RevealedCheckboxList } from "@app/components/revealed-checkbox-list"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { useMigrationAccount } from "@app/screens/account-migration/hooks"
import { MigrationStepLayout } from "@app/screens/account-migration/migration-step-layout"
import { testProps } from "@app/utils/testProps"

export const MigrationExplainerScreen: React.FC = () => {
  const { LL } = useI18nContext()
  const {
    theme: { colors },
  } = useTheme()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const {
    ensureAccount,
    isProvisioning,
    loading: checkpointLoading,
  } = useMigrationAccount()

  const [areAllChecked, setAreAllChecked] = useState(false)

  const checkLabels = [
    LL.AccountMigration.explainerCheck1(),
    LL.AccountMigration.explainerCheck2(),
    LL.AccountMigration.explainerCheck3(),
    LL.AccountMigration.explainerCheck4(),
    LL.AccountMigration.explainerCheck5(),
  ]

  const isMoveDisabled = !areAllChecked || isProvisioning || checkpointLoading

  const handleMove = useCallback(async () => {
    const provisionedAccountId = await ensureAccount()
    if (provisionedAccountId) {
      navigation.navigate("acceptTermsAndConditions", { flow: "migration" })
    }
  }, [ensureAccount, navigation])

  return (
    <MigrationStepLayout
      footer={
        <GaloyPrimaryButton
          title={LL.AccountMigration.explainerCta()}
          disabled={isMoveDisabled}
          loading={isProvisioning}
          onPress={handleMove}
          {...testProps("migration-explainer-cta")}
        />
      }
    >
      <IconHero
        icon="key-outline"
        iconColor={colors.black}
        title={LL.AccountMigration.explainerTitle()}
      />
      <RevealedCheckboxList
        labels={checkLabels}
        testIdPrefix="migration-explainer-check"
        onAllCheckedChange={setAreAllChecked}
      />
    </MigrationStepLayout>
  )
}
