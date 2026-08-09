import React from "react"
import { ScrollView, View } from "react-native"

import { Divider, makeStyles, useTheme } from "@rn-vui/themed"

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

const TOOLS_DIVIDER_WIDTH = 1

const TOOL_ICON_SIZE = 20

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

  /** The gate renders this step in place, so an unguarded system back pops the whole flow
   *  where the arrow on screen only steps back one. */
  useHardwareBackGuard(onBack)

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

      {/** Scrolls under a fixed hero so a long translation never pushes Got it off screen. */}
      <ScrollView style={styles.scroll} contentContainerStyle={styles.body}>
        <View style={styles.toolsCard} {...testProps("migration-merchant-tools-card")}>
          {tools.map((tool, index) => (
            <React.Fragment key={tool.icon}>
              {index > 0 && (
                <Divider
                  color={colors.grey4}
                  width={TOOLS_DIVIDER_WIDTH}
                  style={styles.toolsDivider}
                />
              )}
              <SettingItemRow
                leftIcon={tool.icon}
                leftIconSize={TOOL_ICON_SIZE}
                title={tool.title}
                subtitle={tool.body}
                rightIcon={null}
                containerStyle={styles.toolRow}
              />
            </React.Fragment>
          ))}
        </View>
      </ScrollView>
    </MigrationStepLayout>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  scroll: {
    flex: 1,
  },
  body: {
    paddingTop: 30,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  toolsCard: {
    backgroundColor: colors.grey5,
    borderRadius: 8,
    overflow: "hidden",
  },
  toolsDivider: {
    marginHorizontal: 10,
  },
  toolRow: {
    backgroundColor: colors.transparent,
    borderRadius: 0,
    paddingVertical: 4,
  },
}))
