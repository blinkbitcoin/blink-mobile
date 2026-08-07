import React from "react"
import { View } from "react-native"

import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { GaloySecondaryButton } from "@app/components/atomic/galoy-secondary-button"
import { IconHero } from "@app/components/icon-hero"
import { useI18nContext } from "@app/i18n/i18n-react"
import {
  coveredSats,
  type VerifiedEmergencyBundle,
} from "@app/self-custodial/recovery-bundle/emergency-recovery"
import { testProps } from "@app/utils/testProps"

import { OnboardingScreenLayout } from "../../../layouts"

type RecoverySummaryViewProps = {
  verified: VerifiedEmergencyBundle
  onExport: () => void
  onSupport: () => void
  onClose: () => void
}

const formatDate = (iso: string): string => {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString()
}

/**
 * Where the flow ends, and the one screen the designs do not cover.
 *
 * A green tick alone would read as "your funds are on their way back", and they
 * are not: the app cannot broadcast the exit yet. So this says what was proven
 * (this bundle covers this balance) and what happens next (support drives the
 * exit with the recovery tooling), and offers the bundle as a file for the user
 * who pasted it out of a password manager.
 */
export const RecoverySummaryView: React.FC<RecoverySummaryViewProps> = ({
  verified,
  onExport,
  onSupport,
  onClose,
}) => {
  const { LL } = useI18nContext()
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  const rows: ReadonlyArray<{ label: string; value: string }> = [
    {
      label: LL.EmergencyRecovery.summaryCovered(),
      value: `${coveredSats(verified.bundle).toLocaleString()} sats`,
    },
    {
      label: LL.EmergencyRecovery.summaryOutputs(),
      value: String(verified.bundle.leaves.length),
    },
    {
      label: LL.EmergencyRecovery.summaryCreated(),
      value: formatDate(verified.metadata.bundleCreatedAt),
    },
  ]

  return (
    <OnboardingScreenLayout
      scrollable
      footer={
        <>
          <GaloyPrimaryButton
            title={LL.EmergencyRecovery.summarySupport()}
            onPress={onSupport}
            {...testProps("summary-support-button")}
          />
          <GaloySecondaryButton
            title={LL.EmergencyRecovery.summaryExport()}
            onPress={onExport}
            {...testProps("summary-export-button")}
          />
          <GaloySecondaryButton
            title={LL.EmergencyRecovery.summaryDone()}
            onPress={onClose}
            {...testProps("summary-close-button")}
          />
        </>
      }
    >
      <IconHero
        icon="approved"
        iconColor={colors._green}
        title={LL.EmergencyRecovery.summaryTitle()}
        subtitle={LL.EmergencyRecovery.summaryBody()}
      />

      <View style={styles.rows}>
        {rows.map(({ label, value }) => (
          <View key={label} style={styles.row}>
            <Text type="p2" color={colors.grey3}>
              {label}
            </Text>
            <Text type="p2">{value}</Text>
          </View>
        ))}
      </View>
    </OnboardingScreenLayout>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  rows: {
    marginTop: 28,
    borderRadius: 12,
    backgroundColor: colors.grey5,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
  },
}))
