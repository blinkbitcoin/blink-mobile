import React, { useCallback, useEffect } from "react"
import { View } from "react-native"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { IconHero } from "@app/components/icon-hero"
import { Screen } from "@app/components/screen"
import { useAddressScreenQuery } from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { useAppConfig } from "@app/hooks"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { useMigrationCheckpoint } from "@app/screens/account-migration/hooks"
import { getLightningAddress } from "@app/utils/pay-links"
import { testProps } from "@app/utils/testProps"

export const MigrationKeepReceivingScreen: React.FC = () => {
  const { LL } = useI18nContext()
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()

  const {
    appConfig: {
      galoyInstance: { lnAddressHostname },
    },
  } = useAppConfig()

  const { getRouteForCheckpoint, loading: checkpointLoading } = useMigrationCheckpoint()

  const isAuthed = useIsAuthed()
  const { data, loading: addressLoading } = useAddressScreenQuery({
    fetchPolicy: "cache-first",
    skip: !isAuthed,
  })

  const username = data?.me?.username
  const lightningAddress = username
    ? getLightningAddress(lnAddressHostname, username)
    : ""

  const isCheckReady = !addressLoading && !checkpointLoading
  const hasLightningAddress = Boolean(username)
  const shouldSkipScreen = isCheckReady && !hasLightningAddress

  /** TODO: only route to download-history when the account has at least one transaction. */
  const goToNextStep = useCallback(() => {
    navigation.navigate("accountMigrationDownloadHistory")
  }, [navigation])

  /** Guard: this screen needs a lightning address; without one, skip into the flow. */
  useEffect(() => {
    if (shouldSkipScreen) navigation.replace(getRouteForCheckpoint())
  }, [shouldSkipScreen, navigation, getRouteForCheckpoint])

  if (!isCheckReady || !hasLightningAddress) return null

  return (
    <Screen preset="fixed">
      <View style={styles.container}>
        <View style={styles.content}>
          <IconHero
            icon="lightning-address"
            iconColor={colors._green}
            title={LL.AccountMigration.keepReceivingTitle()}
            subtitle={LL.AccountMigration.keepReceivingBody()}
          />

          <View style={styles.addressBlock}>
            <Text style={styles.addressLabel}>
              {LL.AccountMigration.keepReceivingLnAddressLabel()}
            </Text>
            <Text
              style={styles.addressValue}
              numberOfLines={1}
              ellipsizeMode="middle"
              {...testProps("migration-ln-address")}
            >
              {lightningAddress}
            </Text>
          </View>
        </View>

        <View style={styles.buttonsContainer}>
          <GaloyPrimaryButton
            title={LL.AccountMigration.keepReceivingCta()}
            onPress={goToNextStep}
            {...testProps("migration-keep-receiving-cta")}
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
  },
  addressBlock: {
    paddingTop: 30,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  addressLabel: {
    color: colors.grey2,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
    textAlign: "center",
  },
  addressValue: {
    fontSize: 18,
    lineHeight: 24,
    textAlign: "center",
  },
  buttonsContainer: {
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 10,
  },
}))
