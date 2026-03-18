import React from "react"
import { useNotificationSettingsQuery } from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"

import { NotificationCategories } from "../notifications-screen"
import { SettingsRow } from "../row"

const TOTAL_CATEGORIES = Object.keys(NotificationCategories).length

export const NotificationSetting: React.FC = () => {
  const { LL } = useI18nContext()
  const { navigate } = useNavigation<StackNavigationProp<RootStackParamList>>()
  const isAuthed = useIsAuthed()
  const { data } = useNotificationSettingsQuery({
    fetchPolicy: "cache-first",
    skip: !isAuthed,
  })

  const pushSettings = data?.me?.defaultAccount?.notificationSettings?.push
  const disabledCount = pushSettings?.disabledCategories.length ?? 0

  const getStatusLabel = () => {
    if (disabledCount === 0) return LL.NotificationSettingsScreen.statusAll()
    if (disabledCount >= TOTAL_CATEGORIES)
      return LL.NotificationSettingsScreen.statusNone()
    return LL.NotificationSettingsScreen.statusSome()
  }

  return (
    <SettingsRow
      title={`${LL.common.notifications()}: ${getStatusLabel()}`}
      leftGaloyIcon="bell"
      action={() => navigate("notificationSettingsScreen")}
    />
  )
}
