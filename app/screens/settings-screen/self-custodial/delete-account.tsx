import React, { useState } from "react"
import { ActivityIndicator, View } from "react-native"

import { useNavigation, type NavigationProp } from "@react-navigation/native"
import { makeStyles, Overlay, Text, useTheme } from "@rn-vui/themed"

import { InfoCard } from "@app/components/card-screen"
import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { useI18nContext } from "@app/i18n/i18n-react"
import { type RootStackParamList } from "@app/navigation/stack-param-lists"
import { useDeleteAccount } from "@app/self-custodial/hooks/use-delete-account"
import { useSelfCustodialWallet } from "@app/self-custodial/providers/wallet"
import { AccountType } from "@app/types/wallet"
import { hasFunds } from "@app/utils/has-funds"
import { testProps } from "@app/utils/testProps"

import { SettingsButton } from "../button"

import { DeleteAccountConfirmModal } from "./delete-account-confirm-modal"
import { DeleteAccountHasFundsModal } from "./delete-account-has-funds-modal"
import { navigateAfterAccountDelete } from "./navigate-after-account-delete"

export const DeleteAccount: React.FC = () => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()
  const navigation = useNavigation<NavigationProp<RootStackParamList>>()
  const { activeAccount } = useAccountRegistry()
  const { state, deleteWallet } = useDeleteAccount()
  const { wallets } = useSelfCustodialWallet()

  const [confirmVisible, setConfirmVisible] = useState(false)
  const [warningVisible, setWarningVisible] = useState(false)

  const handleDeletePress = () => {
    if (hasFunds(wallets)) {
      setWarningVisible(true)
      return
    }
    setConfirmVisible(true)
  }

  const handleConfirm = async () => {
    if (activeAccount?.type !== AccountType.SelfCustodial) return
    setConfirmVisible(false)
    const outcome = await deleteWallet(activeAccount.id)
    if (outcome) navigateAfterAccountDelete(navigation, outcome)
  }

  const bulletItems = [
    LL.SelfCustodialDelete.dangerZoneBulletReinstated(),
    LL.SelfCustodialDelete.dangerZoneBulletPermanent(),
    LL.SelfCustodialDelete.dangerZoneBulletEmpty(),
  ]

  return (
    <View style={styles.container}>
      <InfoCard
        title={LL.SelfCustodialDelete.dangerZoneImportantTitle()}
        bulletItems={bulletItems}
        bulletSpacing={4}
      />

      <SettingsButton
        title={LL.SelfCustodialDelete.dangerZoneDeleteButton()}
        variant="critical"
        onPress={handleDeletePress}
        {...testProps("self-custodial-danger-zone-delete-button")}
      />

      <Overlay isVisible={state === "deleting"} overlayStyle={styles.overlayStyle}>
        <ActivityIndicator size={50} color={colors.primary} />
        <Text>{LL.AccountScreen.pleaseWait()}</Text>
      </Overlay>

      <DeleteAccountHasFundsModal
        isVisible={warningVisible}
        onClose={() => setWarningVisible(false)}
        wallets={wallets}
      />

      <DeleteAccountConfirmModal
        isVisible={confirmVisible}
        onClose={() => setConfirmVisible(false)}
        onConfirm={handleConfirm}
      />
    </View>
  )
}

const useStyles = makeStyles(() => ({
  container: {
    flexDirection: "column",
    rowGap: 18,
    marginTop: 8,
  },
  overlayStyle: {
    backgroundColor: "transparent",
    shadowColor: "transparent",
  },
}))
