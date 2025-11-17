import { ScrollView } from "react-native-gesture-handler"

import { Screen } from "@app/components/screen"
import { testProps } from "@app/utils/testProps"
import { makeStyles } from "@rn-vui/themed"

import { SettingsGroup } from "../group"
import { AccountDeleteContextProvider } from "./account-delete-context"
import { AccountId } from "./id"
import { DangerZoneSettings } from "./settings/danger-zone"
import { UpgradeAccountLevelOne } from "./settings/upgrade"
import { UpgradeTrialAccount } from "./settings/upgrade-trial-account"
import { useI18nContext } from "@app/i18n/i18n-react"
import { AccountBannerVertical } from "./banner-vertical"

export const AccountScreen: React.FC = () => {
  const styles = useStyles()
  const { LL } = useI18nContext()

  return (
    <AccountDeleteContextProvider>
      <Screen keyboardShouldPersistTaps="handled">
        <ScrollView
          contentContainerStyle={styles.outer}
          {...testProps("account-screen-scroll-view")}
        >
          <AccountBannerVertical />
          <UpgradeTrialAccount />
          <SettingsGroup
            items={[UpgradeAccountLevelOne]}
            name={LL.AccountScreen.upgrade()}
          />
          <AccountId />
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
}))
