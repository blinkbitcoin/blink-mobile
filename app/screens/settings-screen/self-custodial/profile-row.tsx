import React, { useState } from "react"
import {
  AccessibilityActionEvent,
  ActivityIndicator,
  TouchableOpacity,
  View,
} from "react-native"

import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { ListItem, makeStyles, Overlay, Text, useTheme } from "@rn-vui/themed"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { GaloyIconButton } from "@app/components/atomic/galoy-icon-button/galoy-icon-button"
import { useRemoteConfig } from "@app/config/feature-flags-context"
import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { useLogoutAndRoute } from "@app/hooks/use-logout-and-route"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { DeleteAccountConfirmModal } from "./delete-account-confirm-modal"
import { DeleteAccountHasFundsModal } from "./delete-account-has-funds-modal"
import { isRegtestNetwork } from "@app/self-custodial/config"
import { useLnurlServer } from "@app/self-custodial/hooks/use-lnurl-server"
import { useSparkNetwork } from "@app/self-custodial/hooks/use-spark-network"
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

/** A blank address is no address: it must not mask a stored one or render an empty title. */
const presentAddress = (address: string | null): string | null => address?.trim() || null

/** The row is one accessibility element, so VoiceOver can't focus the nested delete button: expose it as an action. */
const REMOVE_ACTION = "remove"

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

  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const { activeAccount, setActiveAccountId } = useAccountRegistry()
  const { lightningAddress: liveLightningAddress, wallets: liveWallets } =
    useSelfCustodialWallet()
  const { selfCustodialDepositClaimLeewayVbyte } = useRemoteConfig()
  const { state: deleteState, deleteWallet } = useDeleteAccount()
  const { routeAfterLogout } = useLogoutAndRoute()
  const network = useSparkNetwork()
  const { domain: lnurlDomain } = useLnurlServer()

  const [confirmVisible, setConfirmVisible] = useState(false)
  const [hasFundsWarningVisible, setHasFundsWarningVisible] = useState(false)
  const [warningWallets, setWarningWallets] = useState<ReadonlyArray<WalletState>>([])
  const [probingBalance, setProbingBalance] = useState(false)

  const isActive =
    activeAccount?.type === AccountType.SelfCustodial && activeAccount.id === accountId

  const lightningAddress = isActive
    ? presentAddress(liveLightningAddress) ?? presentAddress(persistedLightningAddress)
    : presentAddress(persistedLightningAddress)
  const rowTitle = lightningAddress ?? LL.common.anonymousUser()
  const accountTypeLabel = LL.AccountTypeSelectionScreen.selfCustodialLabel()
  const removeAccountLabel = LL.ProfileScreen.removeAccount()

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

    /**
     * Regtest accounts are deletable regardless of funds, so the balance is
     * irrelevant: skip the probe (an SDK connect) and confirm directly.
     */
    if (isRegtestNetwork(network)) {
      setConfirmVisible(true)
      return
    }

    if (isActive) {
      openModalForWallets(liveWallets ?? [])
      return
    }

    setProbingBalance(true)
    const result = await probeSelfCustodialAccountWallets({
      accountId,
      network,
      leewaySatPerVbyte: selfCustodialDepositClaimLeewayVbyte,
      lnurlDomain,
    })
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

  const handleAccessibilityAction = ({ nativeEvent }: AccessibilityActionEvent) => {
    if (nativeEvent.actionName === REMOVE_ACTION) handleRemovePress()
  }

  const handleConfirm = async () => {
    setConfirmVisible(false)
    const outcome = await deleteWallet(accountId)
    if (outcome) navigateAfterAccountDelete(navigation, routeAfterLogout, outcome)
  }

  const dismissHasFundsWarning = () => {
    setHasFundsWarningVisible(false)
    setWarningWallets([])
  }

  return (
    <>
      <TouchableOpacity
        onPress={handleSwitch}
        testID={`profile-row-${accountId}`}
        accessible
        accessibilityRole="button"
        accessibilityLabel={`${rowTitle}, ${accountTypeLabel}`}
        accessibilityState={{ selected: isActive }}
        accessibilityActions={[{ name: REMOVE_ACTION, label: removeAccountLabel }]}
        onAccessibilityAction={handleAccessibilityAction}
      >
        <ListItem
          bottomDivider
          containerStyle={[styles.listStyle, isFirstItem && styles.firstItem]}
        >
          {isActive ? (
            <GaloyIcon name="check-circle" size={20} color={colors.staticSuccess} />
          ) : (
            <View style={styles.spacer} />
          )}
          <ListItem.Content>
            <ListItem.Title numberOfLines={1} ellipsizeMode="middle">
              {rowTitle}
            </ListItem.Title>
            <Text type="p3" style={styles.subtleText}>
              {accountTypeLabel}
            </Text>
          </ListItem.Content>
          {probingBalance ? (
            <ActivityIndicator
              size="small"
              color={colors.accent}
              {...testProps(`probe-spinner-${accountId}`)}
            />
          ) : (
            <GaloyIconButton
              name="close"
              size="small"
              onPress={handleRemovePress}
              backgroundColor={colors.border}
              testID={`delete-button-${accountId}`}
              accessibilityRole="button"
              accessibilityLabel={removeAccountLabel}
            />
          )}
        </ListItem>
      </TouchableOpacity>
      <Overlay isVisible={deleteState === "deleting"} overlayStyle={styles.overlayStyle}>
        <ActivityIndicator size={50} color={colors.accent} />
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
    borderColor: colors.surfaceInteractive,
    backgroundColor: colors.backgroundDefault,
  },
  firstItem: {
    marginTop: 0,
    borderTopWidth: 2,
  },
  spacer: {
    width: 20,
  },
  subtleText: {
    color: colors.textMuted,
  },
  overlayStyle: {
    backgroundColor: "transparent",
    shadowColor: "transparent",
  },
}))
