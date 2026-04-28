import React from "react"

import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"

import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { AccountType } from "@app/types/wallet.types"

import { SettingsRow } from "../row"

export const SelfCustodialAccountInformationSetting: React.FC = () => {
  const { LL } = useI18nContext()
  const { navigate } = useNavigation<StackNavigationProp<RootStackParamList>>()
  const { activeAccount } = useAccountRegistry()

  if (activeAccount?.type !== AccountType.SelfCustodial) return null

  return (
    <SettingsRow
      title={LL.common.accountInformation()}
      leftGaloyIcon="info"
      action={() => navigate("selfCustodialAccountInformationScreen")}
    />
  )
}
