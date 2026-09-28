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
 * - gate: the account is closed server-side (post-deadline); balances shown, and no close
 *   unless the caller allows one (a migration that already completed).
 */
export type MigrationMode = "voluntary" | "forcedPreDeadline" | "gate"

type MigrationRequiredScreenProps = {
  mode: MigrationMode
  onClose?: () => void
  /** Suppresses the close the mode would otherwise allow, for a user the server has
   *  already locked into the flow: the mode still picks the copy, but a migration past
   *  its point of no return has no way out whatever phase the wind-down is in. */
  isExitBlocked?: boolean
}

type ModePresentation = {
  heroIcon: React.ComponentProps<typeof IconHero>["icon"]
  heroIconColor: string
  title: string
  subtitle: React.ReactNode
  shouldShowBalances: boolean
}

export const MigrationRequiredScreen: React.FC<MigrationRequiredScreenProps> = ({
  mode,
  onClose,
  /** The closed gate stays shut unless the caller explicitly opens it, so a render that
   *  forgets the prop can never offer a way out of a closed account. */
  isExitBlocked = mode === "gate",
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
  const {
    data: addressData,
    loading: addressLoading,
    error: addressError,
  } = useAddressScreenQuery({
    fetchPolicy: "cache-first",
    skip: !isAuthed,
  })
  const hasLightningAddress = Boolean(addressData?.me?.username)

  /** With a lightning address the intro passes through the keep-receiving screen;
   *  otherwise it routes straight into the flow's next step. */
  const handleMigrate = useCallback(() => {
    /** Route through keep-receiving whenever an address cannot be ruled out (has one, or the
     *  query errored): skipping to the next step would drop the warning for a user whose
     *  address an offline query just failed to return. */
    const shouldRouteToKeepReceiving = hasLightningAddress || Boolean(addressError)
    if (shouldRouteToKeepReceiving) {
      navigation.navigate("accountMigrationKeepReceiving")
      return
    }
    goToNextStep()
  }, [navigation, hasLightningAddress, addressError, goToNextStep])

  /** Held until the address query settles so a fast cold-start tap can't route past the
   *  keep-receiving warning for a user who actually has an address. */
  const isMigrateLoading = nextStepLoading || addressLoading

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
      shouldShowBalances: false,
    },
    forcedPreDeadline: {
      heroIcon: "upgrade",
      heroIconColor: colors._green,
      title: LL.AccountMigration.migrationRequiredTitle(),
      subtitle: LL.AccountMigration.migrationRequiredForcedBody(),
      shouldShowBalances: false,
    },
    gate: {
      heroIcon: "warning",
      heroIconColor: colors.warning,
      title: LL.AccountMigration.migrationGateTitle(),
      subtitle: gateBody,
      shouldShowBalances: true,
    },
  }
  const presentation = presentationByMode[mode]
  /** Whether a close is offered is the caller's call alone: every mode can be left, and
   *  the closed gate stays shut by default unless the caller opens it. */
  const canClose = !isExitBlocked
  const closeAction = canClose ? handleClose : undefined

  return (
    <MigrationStepLayout
      headerShown={false}
      header={<MigrationCloseHeader onClose={closeAction} testID="migration-close" />}
      contentStyle={styles.contentGap}
      footer={
        <GaloyPrimaryButton
          title={LL.common.continue()}
          onPress={handleMigrate}
          loading={isMigrateLoading}
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
