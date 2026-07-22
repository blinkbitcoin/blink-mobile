import React from "react"

import { useTheme } from "@rn-vui/themed"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { GaloySecondaryButton } from "@app/components/atomic/galoy-secondary-button"
import { IconHero } from "@app/components/icon-hero"
import { useContactSupport } from "@app/hooks/use-contact-support"
import { useI18nContext } from "@app/i18n/i18n-react"
import { MigrationCloseHeader } from "@app/screens/account-migration/migration-close-header"
import { MigrationStepLayout } from "@app/screens/account-migration/migration-step-layout"
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
  const {
    theme: { colors },
  } = useTheme()
  const { openSupport } = useContactSupport()

  return (
    <MigrationStepLayout
      headerShown={false}
      header={<MigrationCloseHeader onClose={onClose} testID="migration-api-close" />}
      footer={
        <>
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
        </>
      }
    >
      <IconHero
        icon="key-outline"
        iconColor={colors.primary}
        title={LL.AccountMigration.apiServiceTitle()}
        subtitle={LL.AccountMigration.apiServiceBody()}
      />
    </MigrationStepLayout>
  )
}
