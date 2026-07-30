import React from "react"

import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { useSelfCustodialAccountMode } from "@app/hooks/use-self-custodial-account-mode"
import { useI18nContext } from "@app/i18n/i18n-react"
import {
  ChooseExperienceEntry,
  RootStackParamList,
} from "@app/navigation/stack-param-lists"
import { ACCOUNT_MODE_NAMES } from "@app/types/account"
import { AccountType } from "@app/types/wallet"

import { SettingsRow } from "../row"

/** Shown for every self-custodial account: this row is the only path into the mode selection. */
export const AccountModeSetting: React.FC = () => {
  const { LL } = useI18nContext()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const { activeAccount } = useAccountRegistry()
  const { accountMode } = useSelfCustodialAccountMode()

  const isSelfCustodial = activeAccount?.type === AccountType.SelfCustodial
  if (!isSelfCustodial) return null

  const title = accountMode
    ? `${LL.SettingsScreen.mode()}: ${ACCOUNT_MODE_NAMES[accountMode]}`
    : LL.SettingsScreen.mode()
  const openModeSelection = () =>
    navigation.navigate("selfCustodialChooseExperience", {
      entry: ChooseExperienceEntry.Settings,
    })

  return <SettingsRow title={title} leftGaloyIcon="location" action={openModeSelection} />
}
