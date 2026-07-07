import React, { useCallback } from "react"
import { Linking, View } from "react-native"

import { makeStyles, useTheme } from "@rn-vui/themed"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { GaloySecondaryButton } from "@app/components/atomic/galoy-secondary-button"
import { IconHero } from "@app/components/icon-hero"
import { Screen } from "@app/components/screen"
import { useRemoteConfig } from "@app/config/feature-flags-context"
import { useI18nContext } from "@app/i18n/i18n-react"
import { testProps } from "@app/utils/testProps"

type MigrationApiServiceScreenProps = {
  onContinue: () => void
}

export const MigrationApiServiceScreen: React.FC<MigrationApiServiceScreenProps> = ({
  onContinue,
}) => {
  const { LL } = useI18nContext()
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { feedbackEmailAddress } = useRemoteConfig()

  const handleContactSupport = useCallback(() => {
    Linking.openURL(`mailto:${feedbackEmailAddress}`)
  }, [feedbackEmailAddress])

  return (
    <Screen preset="fixed" headerShown={false}>
      <View style={styles.container}>
        <View style={styles.content}>
          <IconHero
            icon="key-outline"
            iconColor={colors.primary}
            title={LL.AccountMigration.apiServiceTitle()}
            subtitle={LL.AccountMigration.apiServiceBody()}
          />
        </View>

        <View style={styles.buttonsContainer}>
          <GaloyPrimaryButton
            title={LL.AccountMigration.apiServiceContactCta()}
            onPress={handleContactSupport}
            {...testProps("migration-api-contact-cta")}
          />
          <GaloySecondaryButton
            title={LL.AccountMigration.apiServiceContinueCta()}
            onPress={onContinue}
            {...testProps("migration-api-continue-cta")}
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
    paddingTop: 60,
  },
  buttonsContainer: {
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 10,
  },
}))
