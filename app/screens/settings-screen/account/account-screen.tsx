import React, { useState, useCallback } from "react"
import { ScrollView, RefreshControl } from "react-native-gesture-handler"

import { makeStyles } from "@rn-vui/themed"

import { Screen } from "@app/components/screen"
import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { useSaveSessionProfile } from "@app/hooks/use-save-session-profile"
import { useI18nContext } from "@app/i18n/i18n-react"
import { useSelfCustodialWallet } from "@app/self-custodial/providers/wallet"
import { AccountType } from "@app/types/wallet"
import { testProps } from "@app/utils/testProps"

import { SettingsGroup } from "../group"
import { SelfCustodialAccountFields } from "../self-custodial/account-fields"

import { AccountDeleteContextProvider } from "./account-delete-context"
import { AccountBannerVertical } from "./banner-vertical"
import { AccountId } from "./id"
import { DangerZoneSettings } from "./settings/danger-zone"
import { UpgradeAccountLevelOne } from "./settings/upgrade"
import { UpgradeTrialAccount } from "./settings/upgrade-trial-account"

export const AccountScreen: React.FC = () => {
  const styles = useStyles()
  const { LL } = useI18nContext()
  const { activeAccount } = useAccountRegistry()
  const { updateCurrentProfile } = useSaveSessionProfile()
  const {
    refreshWallets: refreshSelfCustodialWallets,
    updateCurrentSelfCustodialAccount,
  } = useSelfCustodialWallet()
  const [refreshing, setRefreshing] = useState(false)

  const isSelfCustodial = activeAccount?.type === AccountType.SelfCustodial

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      const work = isSelfCustodial
        ? Promise.all([
            refreshSelfCustodialWallets(),
            updateCurrentSelfCustodialAccount(),
          ])
        : updateCurrentProfile()
      await work
    } finally {
      setRefreshing(false)
    }
  }, [
    isSelfCustodial,
    refreshSelfCustodialWallets,
    updateCurrentSelfCustodialAccount,
    updateCurrentProfile,
  ])

  return (
    <AccountDeleteContextProvider>
      <Screen keyboardShouldPersistTaps="handled">
        <ScrollView
          contentContainerStyle={[
            styles.outer,
            isSelfCustodial && styles.outerSelfCustodial,
          ]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          {...testProps("account-screen-scroll-view")}
        >
          <AccountBannerVertical />
          {isSelfCustodial ? (
            <SelfCustodialAccountFields />
          ) : (
            <>
              <UpgradeTrialAccount />
              <SettingsGroup
                items={[UpgradeAccountLevelOne]}
                name={LL.AccountScreen.upgrade()}
              />
              <AccountId />
            </>
          )}
          <DangerZoneSettings />
        </ScrollView>
      </Screen>
    </AccountDeleteContextProvider>
  )
}

const useStyles = makeStyles(() => ({
  outer: {
    marginTop: 4,
    paddingHorizontal: 12,
    paddingBottom: 20,
    display: "flex",
    flexDirection: "column",
    rowGap: 15,
  },
  outerSelfCustodial: {
    paddingHorizontal: 20,
    rowGap: 20,
  },
}))
