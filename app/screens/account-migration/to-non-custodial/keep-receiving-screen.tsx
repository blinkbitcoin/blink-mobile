import React, { useCallback, useEffect, useState } from "react"
import { ActivityIndicator, View } from "react-native"
import { useIsFocused } from "@react-navigation/native"

import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { GaloySecondaryButton } from "@app/components/atomic/galoy-secondary-button"
import { IconHero } from "@app/components/icon-hero"
import { Screen } from "@app/components/screen"
import { useAddressScreenQuery } from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { useAppConfig } from "@app/hooks"
import { useI18nContext } from "@app/i18n/i18n-react"
import { useMigrationNextStep } from "@app/screens/account-migration/hooks"
import { MigrationStepLayout } from "@app/screens/account-migration/migration-step-layout"
import { getLightningAddress } from "@app/utils/pay-links"
import { reportError } from "@app/utils/error-logging"
import { testProps } from "@app/utils/testProps"

export const MigrationKeepReceivingScreen: React.FC = () => {
  const { LL } = useI18nContext()
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  const {
    appConfig: {
      galoyInstance: { lnAddressHostname },
    },
  } = useAppConfig()

  const {
    goToNextStep,
    replaceToCheckpoint,
    loading: nextStepLoading,
  } = useMigrationNextStep()

  const isAuthed = useIsAuthed()
  const {
    data,
    loading: addressLoading,
    error: addressError,
    refetch: refetchAddress,
  } = useAddressScreenQuery({
    fetchPolicy: "cache-first",
    skip: !isAuthed,
  })

  const username = data?.me?.username
  const lightningAddress = username
    ? getLightningAddress(lnAddressHostname, username)
    : ""

  const isFocused = useIsFocused()
  const hasLightningAddress = Boolean(username)
  const isCheckLoading = addressLoading || nextStepLoading
  /** Skip only when the query resolved WITHOUT error and confirmed no address: an errored
   *  query must never read as "no address" and skip the warning for a user who has one. */
  const isConfirmedWithoutAddress =
    !isCheckLoading && !addressError && !hasLightningAddress
  /** Focus-gated: this screen stays mounted under the stack for the whole migration,
   *  and the post-migration session swap drops the username, which must not make a
   *  background instance replace itself into the flow again. */
  const shouldSkipScreen = isFocused && isConfirmedWithoutAddress

  /** Guard: this screen needs a lightning address; without one, skip into the flow. */
  useEffect(() => {
    if (shouldSkipScreen) replaceToCheckpoint()
  }, [shouldSkipScreen, replaceToCheckpoint])

  const [isRetrying, setIsRetrying] = useState(false)
  /** Retry re-runs the address query over the network; a still-failing refetch rejects, so
   *  catch it and clear the in-flight flag to keep the button tappable for another attempt. */
  const retryAddress = useCallback(async () => {
    setIsRetrying(true)
    try {
      await refetchAddress()
    } catch (err) {
      reportError("Migration keep-receiving address retry", err)
    } finally {
      setIsRetrying(false)
    }
  }, [refetchAddress])

  /** Spinner (not a blank screen) while the check is unresolved, matching the gate. */
  if (isCheckLoading) {
    return (
      <Screen preset="fixed">
        <View style={styles.loadingContainer}>
          <ActivityIndicator
            size="large"
            color={colors.primary}
            {...testProps("migration-keep-receiving-loading")}
          />
        </View>
      </Screen>
    )
  }

  /** The address is informational, not a migration precondition, so a failed lookup offers a
   *  retry but never traps the flow: Continue advances the migration without showing it. */
  if (addressError) {
    return (
      <Screen preset="fixed">
        <View style={styles.messageContainer}>
          <GaloyIcon name="warning" size={64} color={colors.warning} />
          <Text type="p1" style={styles.messageText}>
            {LL.errors.generic()}
          </Text>
          <GaloyPrimaryButton
            title={LL.common.tryAgain()}
            onPress={retryAddress}
            loading={isRetrying}
            disabled={isRetrying}
            {...testProps("migration-keep-receiving-retry")}
          />
          <GaloySecondaryButton
            title={LL.common.continue()}
            onPress={goToNextStep}
            disabled={isRetrying}
            {...testProps("migration-keep-receiving-continue")}
          />
        </View>
      </Screen>
    )
  }

  if (!hasLightningAddress) return null

  return (
    <MigrationStepLayout
      footer={
        <GaloyPrimaryButton
          title={LL.AccountMigration.keepReceivingCta()}
          onPress={goToNextStep}
          {...testProps("migration-keep-receiving-cta")}
        />
      }
    >
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
    </MigrationStepLayout>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  messageContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 16,
  },
  messageText: {
    textAlign: "center",
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
}))
