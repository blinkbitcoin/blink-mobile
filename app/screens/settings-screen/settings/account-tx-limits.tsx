import React from "react"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"

import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { AccountType } from "@app/types/wallet.types"

import { SettingsRow } from "../row"

export const TxLimits: React.FC = () => {
  const { LL } = useI18nContext()
  const { navigate } = useNavigation<StackNavigationProp<RootStackParamList>>()
  const { activeAccount } = useAccountRegistry()

  const target =
    activeAccount?.type === AccountType.SelfCustodial
      ? "selfCustodialTransactionLimitsScreen"
      : "transactionLimitsScreen"

  return (
    <SettingsRow
      title={LL.common.transactionLimits()}
      leftGaloyIcon="info"
      action={() => navigate(target)}
    />
  )
}
