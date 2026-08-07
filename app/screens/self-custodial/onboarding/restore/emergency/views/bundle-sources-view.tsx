import React from "react"

import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { GaloySecondaryButton } from "@app/components/atomic/galoy-secondary-button"
import { IconHero } from "@app/components/icon-hero"
import { useI18nContext } from "@app/i18n/i18n-react"
import { testProps } from "@app/utils/testProps"

import { getCloudProviderName } from "../../../utils"
import { OnboardingScreenLayout } from "../../../layouts"

type BundleSourcesViewProps = {
  busy: boolean
  onCloud: () => void
  onClipboard: () => void
  onFile: () => void
  onHelp: () => void
}

/**
 * Asked only after the automatic attempt found nothing.
 *
 * Three buttons, one code path: each just produces the bundle as text and hands
 * it to the same verifier. Whichever the user takes, being wrong about it costs
 * them one tap, not a different outcome.
 */
export const BundleSourcesView: React.FC<BundleSourcesViewProps> = ({
  busy,
  onCloud,
  onClipboard,
  onFile,
  onHelp,
}) => {
  const { LL } = useI18nContext()
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  return (
    <OnboardingScreenLayout
      footer={
        <>
          <GaloyPrimaryButton
            title={LL.EmergencyRecovery.fromCloud({ provider: getCloudProviderName(LL) })}
            onPress={onCloud}
            disabled={busy}
            {...testProps("bundle-source-cloud")}
          />
          <GaloySecondaryButton
            title={LL.EmergencyRecovery.fromPasswordManager()}
            onPress={onClipboard}
            disabled={busy}
            {...testProps("bundle-source-clipboard")}
          />
          <GaloySecondaryButton
            title={LL.EmergencyRecovery.fromFile()}
            onPress={onFile}
            disabled={busy}
            {...testProps("bundle-source-file")}
          />
        </>
      }
    >
      <IconHero
        icon="emergency-kit"
        iconColor={colors._green}
        title={LL.EmergencyRecovery.sourcesTitle()}
        subtitle={LL.EmergencyRecovery.sourcesBody()}
      />

      <Text style={styles.help} onPress={onHelp} {...testProps("bundle-source-help")}>
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
