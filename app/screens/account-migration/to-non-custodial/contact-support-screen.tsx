import React, { useCallback, useLayoutEffect } from "react"
import { ScrollView, View } from "react-native"

import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { GaloySecondaryButton } from "@app/components/atomic/galoy-secondary-button"
import { HeaderBackButton } from "@react-navigation/elements"
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { IconHero } from "@app/components/icon-hero"
import { IconTextButton } from "@app/components/icon-text-button"
import { Screen } from "@app/components/screen"
import { useClipboard } from "@app/hooks/use-clipboard"
import { useContactSupport } from "@app/hooks/use-contact-support"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { useHardwareBackGuard } from "@app/screens/account-migration/hooks"
/** Deep import on purpose: its device-location chain stays out of the hooks barrel. */
import { useMigrationSupportEmail } from "@app/screens/account-migration/hooks/use-migration-support-email"
import { MigrationSupportOrigin, MigrationSupportReason } from "@app/types/migration"
import { testProps } from "@app/utils/testProps"

/**
 * The migration failure and help screen: funds are safe, but the transfer needs support
 * assistance. It shows the diagnostics support needs (custodial account identity plus the
 * provisioned wallet's pubkey) and pre-fills them, with the app version, into the support
 * email. The support address doubles as a copy control: tapping it puts the address on the
 * clipboard, for a user whose mail app the Contact us button cannot open. The header back
 * control and the hardware back return to the commit point (Step 8) when support was opened
 * mid-migration, or dismiss the screen when it was opened by the completed-migration resume
 * handover; the visible control covers iOS, which has no hardware back.
 */
export const MigrationContactSupportScreen: React.FC = () => {
  const { LL } = useI18nContext()
  const LLSupport = LL.AccountMigration.contactSupport
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()

  const { params } =
    useRoute<RouteProp<RootStackParamList, "accountMigrationContactSupport">>()

  /** Callers must pass a reason, but a navigation-state restore can land here with none;
   *  a named fallback keeps the ticket meaningful instead of crashing on a missing param. */
  const reason = params?.reason ?? MigrationSupportReason.Unknown
  const { diagnostics, sendSupportEmail } = useMigrationSupportEmail(reason)

  /**
   * Back depends on where support was opened from. Mid-migration the commit point (Step 8)
   * is underneath, so Back returns there, skipping the back-swallowing transfer screen a
   * blind goBack would land on. The resume handover is pushed from the root navigator with
   * no migration screens beneath it, so Back dismisses instead of fabricating a fresh commit
   * screen over an already-completed migration, which would re-arm the lock and re-hand the
   * user to support with the wrong reason. A restore with no origin keeps the commit path.
   */
  const isResumeOrigin = params?.origin === MigrationSupportOrigin.Resume
  const handleBack = useCallback(() => {
    if (isResumeOrigin) {
      navigation.goBack()
      return
    }
    navigation.navigate("accountMigrationBalancesOverview")
  }, [isResumeOrigin, navigation])
  useHardwareBackGuard(handleBack)

  /** The back control lives in the navigator header, but its target is set from here so it
   *  reuses this screen's origin-aware back path rather than a blind goBack, which from a
   *  transfer-time failure would land on the swallowing transfer screen. */
  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <HeaderBackButton
          tintColor={colors.black}
          pressColor={colors.grey5}
          pressOpacity={1}
          onPress={handleBack}
          {...testProps("migration-contact-support-back")}
        />
      ),
    })
  }, [navigation, handleBack, colors.black, colors.grey5])

  const { supportEmailAddress } = useContactSupport()
  const { copyToClipboard } = useClipboard()

  /** Copies the support address so the user can paste it into their own mail app when the
   *  Contact us button's mailto has nowhere to open. */
  const copySupportEmail = useCallback(() => {
    copyToClipboard({ content: supportEmailAddress })
  }, [copyToClipboard, supportEmailAddress])

  /** Copies the whole diagnostics block as `label: value` lines, so a user can paste it into
   *  their own message to support instead of transcribing each identifier by hand. */
  const copyDiagnostics = useCallback(() => {
    const details = diagnostics.map(({ label, value }) => `${label}: ${value}`).join("\n")
    copyToClipboard({ content: details })
  }, [copyToClipboard, diagnostics])

  return (
    <Screen preset="fixed">
      <View style={styles.container}>
        <IconHero
          icon="headset"
          iconColor={colors.primary}
          title={LLSupport.title()}
          subtitle={LLSupport.body()}
        />

        <ScrollView style={styles.scroll} contentContainerStyle={styles.body}>
          <View style={styles.card}>
            {diagnostics.map((diagnostic) => {
              /** Identifiers (account id, pubkey) keep the larger value font; the rest use
               *  the smaller one. Every value renders complete, wrapping as needed, because
               *  support needs the whole string, never a truncated one. */
              const valueStyle = diagnostic.isIdentifier
                ? styles.value
                : [styles.value, styles.smallValue]
              return (
                <View key={diagnostic.label} style={styles.row}>
                  <Text style={styles.label}>{diagnostic.label}</Text>
                  <Text style={valueStyle}>{diagnostic.value}</Text>
                </View>
              )
            })}
          </View>

          <IconTextButton
            icon="copy-paste"
            label={LLSupport.copy()}
            onPress={copyDiagnostics}
          />
        </ScrollView>

        <View style={styles.buttonsContainer}>
          <GaloyPrimaryButton
            title={LLSupport.contactUsCta()}
            onPress={sendSupportEmail}
            {...testProps("migration-contact-support-cta")}
          />
          <GaloySecondaryButton
            title={supportEmailAddress}
            onPress={copySupportEmail}
            {...testProps("migration-contact-support-copy")}
          />
        </View>
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
    gap: 14,
  },
  card: {
    width: "100%",
    backgroundColor: colors.grey5,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 14,
    gap: 14,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  label: {
    color: colors.grey2,
    fontSize: 16,
    fontFamily: "Source Sans Pro",
    fontWeight: "400",
    lineHeight: 22,
  },
  value: {
    color: colors.black,
    fontSize: 16,
    fontFamily: "Source Sans Pro",
    fontWeight: "700",
    lineHeight: 22,
    textAlign: "right",
    maxWidth: 200,
  },
  smallValue: {
    fontSize: 14,
    lineHeight: 20,
  },
  buttonsContainer: {
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 10,
  },
}))
