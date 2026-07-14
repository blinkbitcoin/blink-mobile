import React, { useCallback } from "react"
import { View } from "react-native"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { makeStyles, useTheme } from "@rn-vui/themed"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { IconHero } from "@app/components/icon-hero"
import { RichText } from "@app/components/rich-text"
import { Screen } from "@app/components/screen"
import { useAddressScreenQuery } from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { useContactSupport } from "@app/hooks/use-contact-support"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { GateBalances } from "@app/screens/account-migration/gate-balances"
import { useMigrationNextStep } from "@app/screens/account-migration/hooks"
import { MigrationCloseHeader } from "@app/screens/account-migration/migration-close-header"
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

  return (
    <Screen preset="fixed" headerShown={false}>
      <View style={styles.container}>
        <MigrationCloseHeader
          onClose={presentation.shouldShowClose ? handleClose : undefined}
          testID="migration-close"
        />

        <View style={styles.content}>
          <IconHero
            icon={presentation.heroIcon}
            iconColor={presentation.heroIconColor}
            title={presentation.title}
            subtitle={presentation.subtitle}
          />

          {presentation.shouldShowBalances ? <GateBalances /> : null}
        </View>

        <View style={styles.buttonsContainer}>
          <GaloyPrimaryButton
            title={LL.common.continue()}
            onPress={handleMigrate}
            loading={nextStepLoading}
            {...testProps("migration-required-cta")}
          />
        </View>
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  container: {
    flex: 1,
    justifyContent: "space-between",
  },
  content: {
    flex: 1,
    gap: 20,
  },
  buttonsContainer: {
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 10,
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
