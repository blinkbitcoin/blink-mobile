import React, { useState } from "react"
import { ActivityIndicator, TouchableOpacity, View } from "react-native"

import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import { ListItem, makeStyles, Overlay, Text, useTheme } from "@rn-vui/themed"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { GaloyIconButton } from "@app/components/atomic/galoy-icon-button/galoy-icon-button"
import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { DeleteAccountConfirmModal } from "./delete-account-confirm-modal"
import { DeleteAccountHasFundsModal } from "./delete-account-has-funds-modal"
import {
  probeSelfCustodialAccountWallets,
  ProbeAccountWalletsStatus,
} from "@app/self-custodial/probe-account-wallets"
import { useSelfCustodialWallet } from "@app/self-custodial/providers/wallet"
import { type SelfCustodialAccountEntry } from "@app/self-custodial/storage/account-index"
import { AccountType, type WalletState } from "@app/types/wallet"
import { reportError } from "@app/utils/error-logging"
import { hasFunds } from "@app/utils/has-funds"
import { testProps } from "@app/utils/testProps"
import { toastShow } from "@app/utils/toast"

import { useDeleteAccount } from "@app/self-custodial/hooks/use-delete-account"

import { navigateAfterAccountDelete } from "./navigate-after-account-delete"

type ProfileRowProps = {
  entry: SelfCustodialAccountEntry
  isFirstItem?: boolean
}

export const ProfileRow: React.FC<ProfileRowProps> = ({ entry, isFirstItem }) => {
  const { id: accountId, lightningAddress: persistedLightningAddress } = entry
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()

  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()
  const { activeAccount, setActiveAccountId } = useAccountRegistry()
  const { lightningAddress: liveLightningAddress, wallets: liveWallets } =
    useSelfCustodialWallet()
  const { state: deleteState, deleteWallet } = useDeleteAccount()

  const [confirmVisible, setConfirmVisible] = useState(false)
  const [hasFundsWarningVisible, setHasFundsWarningVisible] = useState(false)
  const [warningWallets, setWarningWallets] = useState<ReadonlyArray<WalletState>>([])
  const [probingBalance, setProbingBalance] = useState(false)

  const isActive =
    activeAccount?.type === AccountType.SelfCustodial && activeAccount.id === accountId

  const lightningAddress = isActive
    ? liveLightningAddress ?? persistedLightningAddress
    : persistedLightningAddress
  const rowTitle = lightningAddress ?? LL.common.anonymousUser()

  const handleSwitch = () => {
    if (isActive) return
    setActiveAccountId(accountId)
    toastShow({
      type: "success",
      message: LL.ProfileScreen.switchAccount(),
      LL,
    })
    navigation.navigate("Primary")
  }

  const openModalForWallets = (wallets: ReadonlyArray<WalletState>) => {
    if (hasFunds(wallets)) {
      setWarningWallets(wallets)
      setHasFundsWarningVisible(true)
      return
    }
    setConfirmVisible(true)
  }

  const surfaceProbeFailure = (err: Error) => {
    reportError("profile-row probeBalance", err)
    toastShow({
      type: "error",
      message: LL.AccountScreen.probeBalanceFailed(),
      LL,
    })
  }

  const handleRemovePress = async () => {
    if (probingBalance) return

    if (isActive) {
      openModalForWallets(liveWallets ?? [])
      return
    }

    setProbingBalance(true)
    const result = await probeSelfCustodialAccountWallets(accountId)
    setProbingBalance(false)

    switch (result.status) {
      case ProbeAccountWalletsStatus.Ok:
        openModalForWallets(result.wallets)
        return
      case ProbeAccountWalletsStatus.NoMnemonic:
        setConfirmVisible(true)
        return
      case ProbeAccountWalletsStatus.ProbeFailed:
        surfaceProbeFailure(result.error)
    }
  }

  const handleConfirm = async () => {
    setConfirmVisible(false)
    const outcome = await deleteWallet(accountId)
    if (outcome) navigateAfterAccountDelete(navigation, outcome)
  }

  const dismissHasFundsWarning = () => {
    setHasFundsWarningVisible(false)
    setWarningWallets([])
  }

  return (
    <>
      <TouchableOpacity onPress={handleSwitch} {...testProps(`profile-row-${accountId}`)}>
        <ListItem
          bottomDivider
          containerStyle={[styles.listStyle, isFirstItem && styles.firstItem]}
        >
          {isActive ? (
            <GaloyIcon name="check-circle" size={20} color={colors._green} />
          ) : (
            <View style={styles.spacer} />
          )}
          <ListItem.Content>
            <ListItem.Title numberOfLines={1} ellipsizeMode="middle">
              {rowTitle}
            </ListItem.Title>
            <Text type="p3" style={styles.subtleText}>
              {LL.AccountTypeSelectionScreen.selfCustodialLabel()}
            </Text>
          </ListItem.Content>
          {probingBalance ? (
            <ActivityIndicator
              size="small"
              color={colors.primary}
              {...testProps(`probe-spinner-${accountId}`)}
            />
          ) : (
            <GaloyIconButton
              name="close"
              size="small"
              onPress={handleRemovePress}
              backgroundColor={colors.grey4}
              {...testProps(`delete-button-${accountId}`)}
            />
          )}
        </ListItem>
      </TouchableOpacity>
      <Overlay isVisible={deleteState === "deleting"} overlayStyle={styles.overlayStyle}>
        <ActivityIndicator size={50} color={colors.primary} />
        <Text>{LL.AccountScreen.pleaseWait()}</Text>
      </Overlay>
      <DeleteAccountHasFundsModal
        isVisible={hasFundsWarningVisible}
        onClose={dismissHasFundsWarning}
        wallets={warningWallets}
      />
      <DeleteAccountConfirmModal
        isVisible={confirmVisible}
        onClose={() => setConfirmVisible(false)}
        onConfirm={handleConfirm}
      />
    </>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  listStyle: {
    borderBottomWidth: 2,
    borderColor: colors.grey5,
    backgroundColor: colors.white,
  },
  firstItem: {
    marginTop: 0,
    borderTopWidth: 2,
  },
  spacer: {
    width: 20,
  },
  subtleText: {
    color: colors.grey2,
  },
  overlayStyle: {
    backgroundColor: "transparent",
    shadowColor: "transparent",
  },
}))
