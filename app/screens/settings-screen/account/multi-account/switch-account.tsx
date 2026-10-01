import React, { useState, useEffect } from "react"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { makeStyles } from "@rn-vui/themed"
import { Screen } from "@app/components/screen"

import { useI18nContext } from "@app/i18n/i18n-react"
import { useAppConfig, useSaveSessionProfile } from "@app/hooks"
import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { usePendingMigrationAccounts } from "@app/screens/account-migration/hooks"
import { useMigrationLock } from "@app/screens/account-migration/hooks/use-migration-lock"

import { ProfileRow } from "../../self-custodial/profile-row"

import { ProfileScreen } from "./profile"
import { fetchProfiles } from "./utils"
import { ScrollView, View } from "react-native"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"

export const SwitchAccount: React.FC = () => {
  const styles = useStyles()
  const { LL } = useI18nContext()
  const {
    appConfig: { token: currentToken },
  } = useAppConfig()
  const { saveProfile } = useSaveSessionProfile()

  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()

  const { selfCustodialEntries, activeAccount } = useAccountRegistry()
  const { pendingAccountIds, pendingForActiveAccount } = usePendingMigrationAccounts()
  const { isCompleted: isMigrationCompleted } = useMigrationLock()

  /**
   * Wallets provisioned mid-migration stay hidden until the flow activates them: an empty,
   * unbacked account must never be switchable from here.
   *
   * Except the active account's own once the server completed its migration. The funds
   * have left the custodial account for that wallet, so hiding it strands them whenever the
   * automatic swap cannot finish (the receive is not confirmed, or the app never gets that
   * far). The custodial account stays in the list, so switching is never one-way. The
   * automatic swap, which also closes the custodial account, runs while that account is
   * the active one: a user who switched by hand finishes it by switching back.
   */
  const completedMigrationWalletId = isMigrationCompleted ? pendingForActiveAccount : null
  const isSwitchable = (entryId: string): boolean => {
    if (entryId === activeAccount?.id) return true
    if (entryId === completedMigrationWalletId) return true
    return !pendingAccountIds.has(entryId)
  }
  const visibleSelfCustodialEntries = selfCustodialEntries.filter((entry) =>
    isSwitchable(entry.id),
  )

  const [profiles, setProfiles] = useState<ProfileProps[]>([])
  const [nextProfileToken, setNextProfileToken] = useState<string>()

  useEffect(() => {
    let isMounted = true

    const loadProfiles = async () => {
      let profilesList = await fetchProfiles(currentToken)
      if (profilesList.length === 0 && currentToken) {
        await saveProfile(currentToken)
        profilesList = await fetchProfiles(currentToken)
      }
      if (isMounted) {
        setProfiles(profilesList)
        setNextProfileToken(profilesList.find((profile) => !profile.selected)?.token)
      }
    }

    loadProfiles()
    return () => {
      isMounted = false
    }
  }, [saveProfile, currentToken])

  const handleAddNew = () => {
    navigation.navigate("getStarted")
  }

  return (
    <Screen keyboardShouldPersistTaps="handled">
      <ScrollView contentContainerStyle={styles.outer}>
        {profiles.map((profile, index) => (
          <ProfileScreen
            key={profile.accountId || profile.userId || index}
            {...profile}
            isFirstItem={index === 0}
            nextProfileToken={nextProfileToken}
          />
        ))}
        {visibleSelfCustodialEntries.map((entry, index) => (
          <ProfileRow
            key={entry.id}
            entry={entry}
            isFirstItem={profiles.length === 0 && index === 0}
          />
        ))}
      </ScrollView>
      <View style={styles.buttonsContainer}>
        <GaloyPrimaryButton
          onPress={handleAddNew}
          title={LL.ProfileScreen.addAccount()}
        />
      </View>
    </Screen>
  )
}

export const useStyles = makeStyles(() => ({
  outer: {
    marginTop: 4,
    paddingBottom: 20,
    flexDirection: "column",
  },
  buttonsContainer: {
    justifyContent: "flex-end",
    marginBottom: 14,
    marginHorizontal: 20,
  },
}))
