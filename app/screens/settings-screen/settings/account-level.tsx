import React from "react"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"

import { SettingsRow } from "../row"
import { useLevel } from "@app/graphql/level-context"

export const AccountLevelSetting: React.FC = () => {
  const { LL } = useI18nContext()
  const { navigate } = useNavigation<StackNavigationProp<RootStackParamList>>()
  const { currentLevel: level } = useLevel()

  return (
    <SettingsRow
      title={`${LL.common.yourAccount()}: ${LL.AccountScreen.level({ level })}`}
      leftGaloyIcon="user"
      action={() => {
        navigate("accountScreen")
      }}
    />
  )
}
