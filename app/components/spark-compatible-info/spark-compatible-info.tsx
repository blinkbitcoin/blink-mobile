import React from "react"

import { makeStyles, Text } from "@rn-vui/themed"

import { useRemoteConfig } from "@app/config/feature-flags-context"
import { useI18nContext } from "@app/i18n/i18n-react"
import { openExternalUrl } from "@app/utils/external"

import { InfoBanner } from "../info-banner"

// Renders the "works in any Spark-compatible wallet" notice with the wallet list
// URL as a tappable link. Shared by the backup and view-backup phrase screens so
// the copy and the link behaviour stay identical on both.
export const SparkCompatibleInfo: React.FC = () => {
  const { LL } = useI18nContext()
  const styles = useStyles()
  const { sparkCompatibleWalletsUrl } = useRemoteConfig()

  const link = LL.BackupScreen.ManualBackup.Phrase.sparkCompatibleLink()
  const infoText = LL.BackupScreen.ManualBackup.Phrase.sparkCompatible({
    sparkCompatibleLink: link,
  })
  const [textBefore, textAfter] = infoText.split(link)

  const handleOpenLink = React.useCallback(
    () => openExternalUrl(sparkCompatibleWalletsUrl),
    [sparkCompatibleWalletsUrl],
  )

  return (
    <InfoBanner>
      <Text style={styles.infoText}>
        {textBefore}
        <Text
          style={styles.linkText}
          accessibilityRole="link"
          onPress={handleOpenLink}
          testID="spark-compatible-link"
        >
          {link}
        </Text>
        {textAfter}
      </Text>
    </InfoBanner>
  )
}

const useStyles = makeStyles(() => ({
  infoText: {
    fontSize: 12,
    lineHeight: 18,
  },
  linkText: {
    fontSize: 12,
    lineHeight: 18,
    textDecorationLine: "underline",
  },
}))
