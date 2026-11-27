import React from "react"
import { useNotificationSettingsQuery } from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { NotificationCategories } from "../notifications-screen"
import { SettingsRow } from "../row"

const VISIBLE_CATEGORIES: readonly string[] = Object.values(NotificationCategories)
const TOTAL_CATEGORIES = VISIBLE_CATEGORIES.length

export const NotificationSetting: React.FC = () => {
  const { LL } = useI18nContext()
  const { navigate } = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const isAuthed = useIsAuthed()
  const { data } = useNotificationSettingsQuery({
    fetchPolicy: "cache-first",
    skip: !isAuthed,
  })

  const pushSettings = data?.me?.defaultAccount?.notificationSettings?.push
  /** Only the categories this screen lists count: a category it doesn't show, such as
   *  the card's alerts, is turned on and off in card settings. */
  const disabledCount =
    pushSettings?.disabledCategories.filter((category) =>
      VISIBLE_CATEGORIES.includes(category),
    ).length ?? 0

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
