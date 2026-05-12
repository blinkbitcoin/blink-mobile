import React from "react"

import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"

import { useSettingsScreenQuery, WalletCurrency } from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { getBtcWallet } from "@app/graphql/wallets-utils"
import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { usePersistentStateContext } from "@app/store/persistent-state"
import { getSelfCustodialDefaultCurrency } from "@app/store/persistent-state/self-custodial-default-currency"
import { AccountType } from "@app/types/wallet"

import { SettingsRow } from "../row"

export const DefaultWallet: React.FC = () => {
  const { LL } = useI18nContext()
  const { navigate } = useNavigation<StackNavigationProp<RootStackParamList>>()
  const isAuthed = useIsAuthed()
  const { activeAccount } = useAccountRegistry()
  const isSelfCustodial = activeAccount?.type === AccountType.SelfCustodial
  const { persistentState } = usePersistentStateContext()

  const { data, loading } = useSettingsScreenQuery({ skip: !isAuthed || isSelfCustodial })
  const btcWallet = getBtcWallet(data?.me?.defaultAccount?.wallets)

  const custodialDefaultCurrency =
    data?.me?.defaultAccount?.defaultWalletId === btcWallet?.id
      ? WalletCurrency.Btc
      : WalletCurrency.Usd

  const selfCustodialDefaultCurrency = getSelfCustodialDefaultCurrency(persistentState)

  const selectedCurrency = isSelfCustodial
    ? selfCustodialDefaultCurrency
    : custodialDefaultCurrency

  const currencyLabel =
    selectedCurrency === WalletCurrency.Btc ? LL.common.bitcoin() : LL.common.dollar()

  const title = isSelfCustodial
    ? LL.DefaultWalletScreen.titleSelfCustodial()
    : LL.DefaultWalletScreen.title()

  return (
    <SettingsRow
      loading={!isSelfCustodial && loading}
      title={`${title}: ${currencyLabel}`}
      leftGaloyIcon="wallet"
      action={() => {
        navigate("defaultWallet")
      }}
    />
  )
}
