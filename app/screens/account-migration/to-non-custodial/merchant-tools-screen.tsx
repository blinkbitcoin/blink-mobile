import React from "react"
import { ScrollView } from "react-native"

import { makeStyles, useTheme } from "@rn-vui/themed"

import { IconNamesType } from "@app/components/atomic/galoy-icon"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { SettingItemRow } from "@app/components/card-screen"
import { IconHero } from "@app/components/icon-hero"
import { useI18nContext } from "@app/i18n/i18n-react"
import { useHardwareBackGuard } from "@app/screens/account-migration/hooks"
import { MigrationStepHeader } from "@app/screens/account-migration/migration-step-header"
import { MigrationStepLayout } from "@app/screens/account-migration/migration-step-layout"
import { testProps } from "@app/utils/testProps"

type MigrationMerchantToolsScreenProps = {
  onContinue: () => void
  onBack: () => void
}

/**
 * The companion to the API-key warning: the API retires, but every tool for incoming
 * payments keeps working non-custodially, so this lists them instead of leaving the
 * merchant with a dead end.
 */
export const MigrationMerchantToolsScreen: React.FC<
  MigrationMerchantToolsScreenProps
> = ({ onContinue, onBack }) => {
  const { LL } = useI18nContext()
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  const merchantToolsLL = LL.AccountMigration.merchantTools

  /** The gate renders this step in place, so an unguarded Android back would pop the whole
   *  flow while the arrow on screen only steps back one. Both go to the same place. */
  useHardwareBackGuard(onBack)

  /** Each tool carries the icon its Settings row already uses, so the two lists read as
   *  the same product rather than two takes on it. */
  const tools: { icon: IconNamesType; title: string; body: string }[] = [
    {
      icon: "calculator",
      title: merchantToolsLL.terminalTitle(),
      body: merchantToolsLL.terminalBody(),
    },
    {
      icon: "donation-button",
      title: merchantToolsLL.donationTitle(),
      body: merchantToolsLL.donationBody(),
    },
    {
      icon: "btcpay",
      title: merchantToolsLL.btcpayTitle(),
      body: merchantToolsLL.btcpayBody(),
    },
    {
      icon: "woocommerce",
      title: merchantToolsLL.woocommerceTitle(),
      body: merchantToolsLL.woocommerceBody(),
    },
  ]

  return (
    <MigrationStepLayout
      headerShown={false}
      header={
        <MigrationStepHeader onBack={onBack} testIdPrefix="migration-merchant-tools" />
      }
      footer={
        <GaloyPrimaryButton
          title={merchantToolsLL.cta()}
          onPress={onContinue}
          {...testProps("migration-merchant-tools-cta")}
        />
      }
    >
      <IconHero
        icon="receive"
        iconColor={colors._green}
        title={merchantToolsLL.title()}
        subtitle={merchantToolsLL.body()}
      />

      {/** The list scrolls under a fixed hero: four cards plus a long translation
       *  overflow the shortest screens, and the Got it button stays reachable. */}
      <ScrollView style={styles.scroll} contentContainerStyle={styles.tools}>
        {tools.map((tool) => (
          <SettingItemRow
            key={tool.icon}
            leftIcon={tool.icon}
            leftIconColor={colors._green}
            title={tool.title}
            subtitle={tool.body}
            titleStyle={styles.toolTitle}
            rightIcon={null}
          />
        ))}
      </ScrollView>
    </MigrationStepLayout>
  )
}

const useStyles = makeStyles(() => ({
  scroll: {
    flex: 1,
  },
  tools: {
    paddingTop: 24,
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 10,
  },
  toolTitle: {
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 22,
  },
}))
