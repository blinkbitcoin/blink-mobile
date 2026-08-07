import React from "react"
import { useI18nContext } from "@app/i18n/i18n-react"

import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { AccountType } from "@app/types/wallet"

import { SettingsRow } from "../row"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { RootStackParamList } from "@app/navigation/stack-param-lists"

export const ApiAccessSetting: React.FC = () => {
  const { LL } = useI18nContext()
  const { navigate } = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const { activeAccount } = useAccountRegistry()

  /** The API screen documents the custodial GraphQL API; a Spark account has no backend
   *  account to issue keys for. */
  if (activeAccount?.type === AccountType.SelfCustodial) {
    return null
  }

  return (
    <SettingsRow
      title={LL.SettingsScreen.apiAcess()}
      leftGaloyIcon="document-outline"
      action={() => navigate("apiScreen")}
    />
  )
}
