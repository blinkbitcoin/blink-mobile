import React, { useState, useCallback } from "react"
import { ScrollView, RefreshControl } from "react-native-gesture-handler"

import { Screen } from "@app/components/screen"
import { testProps } from "@app/utils/testProps"
import { makeStyles } from "@rn-vui/themed"

import { AccountDeleteContextProvider } from "./account-delete-context"
import { AccountBanner } from "./banner"
import { AccountId } from "./id"
import { DangerZoneSettings } from "./settings/danger-zone"
import { UpgradeAccountLevelOne } from "./settings/upgrade"
import { UpgradeTrialAccount } from "./settings/upgrade-trial-account"
import { SettingsGroup } from "../group"
import { useSaveSessionProfile } from "@app/hooks/use-save-session-profile"

export const AccountScreen: React.FC = () => {
  const styles = useStyles()
  const { updateCurrentProfile } = useSaveSessionProfile()
  const [refreshing, setRefreshing] = useState(false)

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await updateCurrentProfile()
    setRefreshing(false)
  }, [updateCurrentProfile])

  return (
    <AccountDeleteContextProvider>
      <Screen keyboardShouldPersistTaps="handled">
        <ScrollView
          contentContainerStyle={styles.outer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          {...testProps("account-screen-scroll-view")}
        >
          <AccountBanner />
          <AccountId />
          <UpgradeTrialAccount />
          <SettingsGroup items={[UpgradeAccountLevelOne]} />
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
    rowGap: 12,
  },
}))
