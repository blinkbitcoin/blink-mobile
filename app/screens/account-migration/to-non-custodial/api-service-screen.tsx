import React from "react"
import { View } from "react-native"

import { makeStyles, useTheme } from "@rn-vui/themed"

import { GaloyIconButton } from "@app/components/atomic/galoy-icon-button"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { GaloySecondaryButton } from "@app/components/atomic/galoy-secondary-button"
import { IconHero } from "@app/components/icon-hero"
import { Screen } from "@app/components/screen"
import { useContactSupport } from "@app/hooks/use-contact-support"
import { useI18nContext } from "@app/i18n/i18n-react"
import { testProps } from "@app/utils/testProps"

type MigrationApiServiceScreenProps = {
  onContinue: () => void
  onClose?: () => void
}

export const MigrationApiServiceScreen: React.FC<MigrationApiServiceScreenProps> = ({
  onContinue,
  onClose,
}) => {
  const { LL } = useI18nContext()
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { openSupport } = useContactSupport()

  return (
    <Screen preset="fixed" headerShown={false}>
      <View style={styles.container}>
        <View style={styles.header}>
          {onClose ? (
            <GaloyIconButton
              name="close"
              size="medium"
              backgroundColor={colors.grey5}
              onPress={onClose}
              {...testProps("migration-api-close")}
            />
          ) : null}
        </View>

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
            onPress={openSupport}
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
  header: {
    minHeight: 44,
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 10,
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
