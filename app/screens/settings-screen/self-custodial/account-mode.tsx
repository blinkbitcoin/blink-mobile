import React from "react"

import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { DisabledFeature } from "@app/components/disabled-feature"
import { useRestrictedRegion } from "@app/components/restricted-region"
import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { useSelfCustodialAccountMode } from "@app/self-custodial/hooks/use-self-custodial-account-mode"
import { useI18nContext } from "@app/i18n/i18n-react"
import {
  ChooseExperienceEntry,
  RootStackParamList,
} from "@app/navigation/stack-param-lists"
import { AccountMode, ACCOUNT_MODE_NAMES } from "@app/types/account"
import { AccountType } from "@app/types/wallet"

import { SettingsRow } from "../row"

/** Shown for every self-custodial account: this row is the only path into the mode selection. */
export const AccountModeSetting: React.FC = () => {
  const { LL } = useI18nContext()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const { activeAccount } = useAccountRegistry()
  const { accountMode } = useSelfCustodialAccountMode()
  const { isRestrictedRegion, presentRestrictedRegionModal } = useRestrictedRegion()

  const isSelfCustodial = activeAccount?.type === AccountType.SelfCustodial
  if (!isSelfCustodial) return null

  /** An account that never chose behaves as Enhanced, so the row reads that default. */
  const displayedMode = accountMode ?? AccountMode.Enhanced
  const title = `${LL.SettingsScreen.mode()}: ${ACCOUNT_MODE_NAMES[displayedMode]}`
  const openModeSelection = () =>
    navigation.navigate("selfCustodialChooseExperience", {
      entry: ChooseExperienceEntry.Settings,
    })

  /** Switching modes is blocked while the region is restricted. */
  return (
    <DisabledFeature
      disabled={isRestrictedRegion}
      onDisabledPress={presentRestrictedRegionModal}
      accessibilityLabel={title}
    >
      <SettingsRow title={title} leftGaloyIcon="spinner" action={openModeSelection} />
    </DisabledFeature>
  )
}
