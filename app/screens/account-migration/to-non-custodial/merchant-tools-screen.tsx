import React from "react"
import { ScrollView, View } from "react-native"

import { Divider, makeStyles, useTheme } from "@rn-vui/themed"

import { IconNamesType } from "@app/components/atomic/galoy-icon"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { SettingItemRow } from "@app/components/card-screen"
import { IconHero } from "@app/components/icon-hero"
import { useI18nContext } from "@app/i18n/i18n-react"
import { useMigrationNextStep } from "@app/screens/account-migration/hooks"
import { MigrationStepLayout } from "@app/screens/account-migration/migration-step-layout"
import { testProps } from "@app/utils/testProps"

const TOOLS_DIVIDER_WIDTH = 1

const TOOL_ICON_SIZE = 20

/**
 * Follows the lightning-address step: that address is what every tool for incoming
 * payments connects to, so this names the ones that keep working non-custodially. Only
 * accounts with an address get here, because only they walk through that step.
 */
export const MigrationMerchantToolsScreen: React.FC = () => {
  const { LL } = useI18nContext()
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  /** Gated on the hook's own loading, as its contract asks: the destination reads
   *  hasResumableCheckpoint, which is false until the checkpoint query settles, so a tap
   *  landing before then routes a resuming user to the re-provision entry instead. */
  const { goToNextStep, loading: nextStepLoading } = useMigrationNextStep()

  const merchantToolsLL = LL.AccountMigration.merchantTools

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
      footer={
        <GaloyPrimaryButton
          title={merchantToolsLL.cta()}
          onPress={goToNextStep}
          loading={nextStepLoading}
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
