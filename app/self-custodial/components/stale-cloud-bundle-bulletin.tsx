import React, { useCallback } from "react"

import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { NotificationCardUI } from "@app/components/notifications/notification-card-ui"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { getCloudProviderName } from "@app/screens/self-custodial/onboarding/utils"

type StaleCloudBundleBulletinProps = {
  onDismiss: () => void
}

/**
 * Says the emergency bundle in the cloud stopped updating and sends the user
 * back to the cloud backup, which signs in again and uploads the bundle on
 * this device. Styled as every other home bulletin.
 */
export const StaleCloudBundleBulletin: React.FC<StaleCloudBundleBulletinProps> = ({
  onDismiss,
}) => {
  const { LL } = useI18nContext()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()

  const openCloudBackup = useCallback(() => {
    navigation.navigate("selfCustodialCloudBackup")
  }, [navigation])

  return (
    <NotificationCardUI
      title={LL.StaleCloudBundleBulletin.title()}
      text={LL.StaleCloudBundleBulletin.body({ provider: getCloudProviderName(LL) })}
      action={openCloudBackup}
      dismissAction={onDismiss}
      buttonLabel={LL.StaleCloudBundleBulletin.cta()}
    />
  )
}
