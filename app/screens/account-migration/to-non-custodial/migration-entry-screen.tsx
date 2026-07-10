import React, { useEffect } from "react"

import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { useMigrationCheckpoint } from "@app/screens/account-migration/hooks"
import { AccountType } from "@app/types/wallet"

/** Deeplink dispatcher for the migration flow (blink://account-migration): applies the
 *  same evaluation as the Settings entry and replaces itself so it never stays in the stack. */
export const MigrationEntryScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const { activeAccount } = useAccountRegistry()
  const { loading, replaceToCheckpoint, hasResumableCheckpoint } =
    useMigrationCheckpoint()

  const isSelfCustodialAccount = activeAccount?.type === AccountType.SelfCustodial

  useEffect(() => {
    if (loading) return

    if (isSelfCustodialAccount) {
      if (navigation.canGoBack()) {
        navigation.goBack()
        return
      }
      navigation.replace("Primary")
      return
    }

    if (hasResumableCheckpoint) {
      replaceToCheckpoint()
      return
    }

    navigation.replace("accountMigrationStart")
  }, [
    loading,
    isSelfCustodialAccount,
    hasResumableCheckpoint,
    replaceToCheckpoint,
    navigation,
  ])

  return null
}
