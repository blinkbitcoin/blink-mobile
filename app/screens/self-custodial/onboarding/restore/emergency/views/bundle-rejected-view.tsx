import React from "react"

import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { GaloySecondaryButton } from "@app/components/atomic/galoy-secondary-button"
import { IconHero } from "@app/components/icon-hero"
import { useI18nContext } from "@app/i18n/i18n-react"
import { EmergencyBundleRejection } from "@app/self-custodial/recovery-bundle/emergency-recovery"
import { testProps } from "@app/utils/testProps"

import { OnboardingScreenLayout } from "../../../layouts"

type BundleRejectedViewProps = {
  rejection: EmergencyBundleRejection
  onTryAgain: () => void
  onRestoreOther: () => void
  onHelp: () => void
}

/**
 * The bundle did not check out.
 *
 * The two ways that happens need different words: a file that never parsed says
 * nothing about the phrase, while one that parsed and would not decrypt says
 * the phrase and the bundle are from different wallets. Blaming the phrase for
 * a wrongly-picked PDF would send the user to re-check something that is fine.
 */
export const BundleRejectedView: React.FC<BundleRejectedViewProps> = ({
  rejection,
  onTryAgain,
  onRestoreOther,
  onHelp,
}) => {
  const { LL } = useI18nContext()
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  const body =
    rejection === EmergencyBundleRejection.WrongPhrase
      ? LL.EmergencyRecovery.rejectedWrongPhrase()
      : LL.EmergencyRecovery.rejectedNotABundle()

  return (
    <OnboardingScreenLayout
      footer={
        <>
          <GaloyPrimaryButton
            title={LL.EmergencyRecovery.tryAgain()}
            onPress={onTryAgain}
            {...testProps("bundle-rejected-try-again")}
          />
          <GaloySecondaryButton
            title={LL.EmergencyRecovery.restoreOther()}
            onPress={onRestoreOther}
            {...testProps("bundle-rejected-restore-other")}
          />
        </>
      }
    >
      <IconHero
        icon="warning"
        iconColor={colors.primary}
        title={LL.EmergencyRecovery.rejectedTitle()}
        subtitle={body}
      />

      <Text style={styles.help} onPress={onHelp} {...testProps("bundle-rejected-help")}>
        {LL.EmergencyRecovery.needHelp()}
      </Text>
    </OnboardingScreenLayout>
  )
}

const useStyles = makeStyles(() => ({
  help: {
    marginTop: 24,
    textAlign: "center",
    textDecorationLine: "underline",
    fontSize: 16,
    lineHeight: 24,
  },
}))
