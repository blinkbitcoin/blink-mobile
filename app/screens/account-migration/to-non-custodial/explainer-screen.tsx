import React, { useCallback, useState } from "react"
import { View } from "react-native"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { makeStyles, useTheme } from "@rn-vui/themed"

import { useRemoteConfig } from "@app/config/feature-flags-context"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { IconHero } from "@app/components/icon-hero"
import { RevealedCheckboxList } from "@app/components/revealed-checkbox-list"
import { Screen } from "@app/components/screen"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { useMigrationAccount } from "@app/screens/account-migration/hooks"
import { testProps } from "@app/utils/testProps"

export const MigrationExplainerScreen: React.FC = () => {
  const { LL } = useI18nContext()
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const { sparkDepositFeePercent } = useRemoteConfig()
  const { ensureAccount, loading: checkpointLoading } = useMigrationAccount()

  const [allChecked, setAllChecked] = useState(false)
  const [provisioning, setProvisioning] = useState(false)

  const checkLabels = [
    LL.AccountMigration.explainerCheck1(),
    LL.AccountMigration.explainerCheck2(),
    LL.AccountMigration.explainerCheck3(),
    LL.AccountMigration.explainerCheck4({ feePercent: sparkDepositFeePercent }),
  ]

  const handleMove = useCallback(async () => {
    setProvisioning(true)
    const provisionedAccountId = await ensureAccount()
    setProvisioning(false)
    if (provisionedAccountId) navigation.navigate("selfCustodialBackupMethod")
  }, [ensureAccount, navigation])

  return (
    <Screen preset="fixed">
      <View style={styles.container}>
        <View style={styles.content}>
          <IconHero
            icon="key-outline"
            iconColor={colors.black}
            title={LL.AccountMigration.explainerTitle()}
          />
          <RevealedCheckboxList
            labels={checkLabels}
            testIdPrefix="migration-explainer-check"
            onAllCheckedChange={setAllChecked}
          />
        </View>

        <View style={styles.buttonsContainer}>
          <GaloyPrimaryButton
            title={LL.AccountMigration.letsMove()}
            disabled={!allChecked || provisioning || checkpointLoading}
            loading={provisioning}
            onPress={handleMove}
            {...testProps("migration-explainer-cta")}
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
  content: {
    flex: 1,
  },
  buttonsContainer: {
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 10,
  },
}))
