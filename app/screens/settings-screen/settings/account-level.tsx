import React from "react"

import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { useLevel } from "@app/graphql/level-context"
import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { AccountType } from "@app/types/wallet"

import { SettingsRow } from "../row"

export const AccountLevelSetting: React.FC = () => {
  const { LL } = useI18nContext()
  const { navigate } = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const { currentLevel: level } = useLevel()
  const { activeAccount } = useAccountRegistry()

  const isSelfCustodial = activeAccount?.type === AccountType.SelfCustodial
  const accountTypeLabel = isSelfCustodial
    ? LL.AccountTypeSelectionScreen.selfCustodialLabel()
    : LL.AccountScreen.level({ level })

  return (
    <SettingsRow
      title={`${LL.common.yourAccount()}: ${accountTypeLabel}`}
      leftGaloyIcon="user"
      action={() => {
        navigate("accountScreen")
      }}
    />
  )
}
