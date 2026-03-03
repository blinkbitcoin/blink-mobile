import React from "react"
import { Linking } from "react-native"

import { useI18nContext } from "@app/i18n/i18n-react"
import { useRemoteConfig } from "@app/config/feature-flags-context"

import { SettingItemRow } from "./setting-item-row"

type ContactSupportRowProps = {
  onPress?: () => void
  rightIconColor?: string
}

export const ContactSupportRow: React.FC<ContactSupportRowProps> = ({
  onPress,
  rightIconColor,
}) => {
  const { LL } = useI18nContext()
  const { feedbackEmailAddress } = useRemoteConfig()

  const handlePress = onPress ?? (() => Linking.openURL(`mailto:${feedbackEmailAddress}`))

  return (
    <SettingItemRow
      title={LL.AppUpdate.contactSupport()}
      subtitle={feedbackEmailAddress}
      leftIcon="headset"
      rightIconColor={rightIconColor}
      onPress={handlePress}
    />
  )
}
