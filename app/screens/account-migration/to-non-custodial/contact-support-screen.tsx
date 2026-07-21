import React, { useCallback } from "react"
import { ScrollView, View } from "react-native"

import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { GaloySecondaryButton } from "@app/components/atomic/galoy-secondary-button"
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { IconHero } from "@app/components/icon-hero"
import { Screen } from "@app/components/screen"
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
 * email. Back never exits the migration; it returns to the commit point (Step 8) on both
 * platforms, since the hardware-back guard alone would leave iOS with no way back.
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

  /** Back depends on origin: mid-migration it returns to the commit point (Step 8); the
   *  resume handover has no commit screen beneath it, so it dismisses instead of fabricating
   *  one over an already-completed migration. A restore with no origin keeps the commit path. */
  const isResumeOrigin = params?.origin === MigrationSupportOrigin.Resume
  const handleBack = useCallback(() => {
    if (isResumeOrigin) {
      navigation.goBack()
      return
    }
    navigation.navigate("accountMigrationBalancesOverview")
  }, [isResumeOrigin, navigation])
  useHardwareBackGuard(handleBack)

  return (
    <Screen preset="fixed" headerShown={false}>
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
        </ScrollView>

        <View style={styles.buttonsContainer}>
          <GaloyPrimaryButton
            title={LLSupport.contactUsCta()}
            onPress={sendSupportEmail}
            {...testProps("migration-contact-support-cta")}
          />
          <GaloySecondaryButton
            title={LL.common.back()}
            onPress={handleBack}
            {...testProps("migration-contact-support-back")}
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
