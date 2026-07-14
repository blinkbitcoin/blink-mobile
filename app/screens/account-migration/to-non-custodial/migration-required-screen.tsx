import React, { useCallback } from "react"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { makeStyles, useTheme } from "@rn-vui/themed"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { IconHero } from "@app/components/icon-hero"
import { RichText } from "@app/components/rich-text"
import { useAddressScreenQuery } from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { useContactSupport } from "@app/hooks/use-contact-support"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { GateBalances } from "@app/screens/account-migration/gate-balances"
import { useMigrationNextStep } from "@app/screens/account-migration/hooks"
import { MigrationCloseHeader } from "@app/screens/account-migration/migration-close-header"
import { MigrationStepLayout } from "@app/screens/account-migration/migration-step-layout"
import { testProps } from "@app/utils/testProps"

/**
 * The single "Time to upgrade" intro screen rendered in three modes:
 * - voluntary: the user opted in from Settings; can close (back to the app).
 * - forcedPreDeadline: the user is in the migration cohort but the deadline has not
 *   passed; can still close and wait.
 * - gate: the account is closed server-side (post-deadline); no close, balances shown.
 */
export type MigrationMode = "voluntary" | "forcedPreDeadline" | "gate"

type MigrationRequiredScreenProps = {
  mode: MigrationMode
  onClose?: () => void
}

type ModePresentation = {
  heroIcon: React.ComponentProps<typeof IconHero>["icon"]
  heroIconColor: string
  title: string
  subtitle: React.ReactNode
  shouldShowClose: boolean
  shouldShowBalances: boolean
}

export const MigrationRequiredScreen: React.FC<MigrationRequiredScreenProps> = ({
  mode,
  onClose,
}) => {
  const { LL } = useI18nContext()
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const { goToNextStep, loading: nextStepLoading } = useMigrationNextStep()
  const { supportEmailAddress, openSupport } = useContactSupport()

  const isAuthed = useIsAuthed()
  const { data: addressData } = useAddressScreenQuery({
    fetchPolicy: "cache-first",
    skip: !isAuthed,
  })
  const hasLightningAddress = Boolean(addressData?.me?.username)

  /** With a lightning address the intro passes through the keep-receiving screen;
   *  otherwise it routes straight into the flow's next step. */
  const handleMigrate = useCallback(() => {
    if (hasLightningAddress) {
      navigation.navigate("accountMigrationKeepReceiving")
      return
    }
    goToNextStep()
  }, [navigation, hasLightningAddress, goToNextStep])

  const handleClose = useCallback(() => {
    if (onClose) {
      onClose()
      return
    }
    navigation.goBack()
  }, [onClose, navigation])

  const gateBody = (
    <RichText
      text={LL.AccountMigration.migrationGateBody({ email: supportEmailAddress })}
      style={styles.gateBody}
      tags={{ link: { style: styles.gateLink, onPress: openSupport } }}
    />
  )

  /** Everything the mode drives lives here, so a fourth mode is one new entry. */
  const presentationByMode: Record<MigrationMode, ModePresentation> = {
    voluntary: {
      heroIcon: "upgrade",
      heroIconColor: colors._green,
      title: LL.AccountMigration.migrationRequiredTitle(),
      subtitle: LL.AccountMigration.migrationRequiredBody(),
      shouldShowClose: true,
      shouldShowBalances: false,
    },
    forcedPreDeadline: {
      heroIcon: "upgrade",
      heroIconColor: colors._green,
      title: LL.AccountMigration.migrationRequiredTitle(),
      subtitle: LL.AccountMigration.migrationRequiredForcedBody(),
      shouldShowClose: true,
      shouldShowBalances: false,
    },
    gate: {
      heroIcon: "warning",
      heroIconColor: colors.warning,
      title: LL.AccountMigration.migrationGateTitle(),
      subtitle: gateBody,
      shouldShowClose: false,
      shouldShowBalances: true,
    },
  }
  const presentation = presentationByMode[mode]
  const closeAction = presentation.shouldShowClose ? handleClose : undefined

  return (
    <MigrationStepLayout
      headerShown={false}
      header={<MigrationCloseHeader onClose={closeAction} testID="migration-close" />}
      contentStyle={styles.contentGap}
      footer={
        <GaloyPrimaryButton
          title={LL.common.continue()}
          onPress={handleMigrate}
          loading={nextStepLoading}
          {...testProps("migration-required-cta")}
        />
      }
    >
      <IconHero
        icon={presentation.heroIcon}
        iconColor={presentation.heroIconColor}
        title={presentation.title}
        subtitle={presentation.subtitle}
      />

      {presentation.shouldShowBalances ? <GateBalances /> : null}
    </MigrationStepLayout>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  contentGap: {
    gap: 20,
  },
  gateBody: {
    fontSize: 16,
    lineHeight: 22,
    textAlign: "center",
    color: colors.black,
  },
  gateLink: {
    textDecorationLine: "underline",
    color: colors.black,
  },
}))
