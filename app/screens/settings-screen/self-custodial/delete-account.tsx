import React, { useState } from "react"
import { ActivityIndicator, View } from "react-native"

import { useNavigation } from "@react-navigation/native"
import { type NativeStackNavigationProp } from "@react-navigation/native-stack"
import { makeStyles, Overlay, Text, useTheme } from "@rn-vui/themed"

import { InfoCard } from "@app/components/card-screen"
import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { useI18nContext } from "@app/i18n/i18n-react"
import { type RootStackParamList } from "@app/navigation/stack-param-lists"
import { useMigrationDeletionGuard } from "@app/screens/account-migration/hooks/use-migration-deletion-guard"
import { isRegtestNetwork } from "@app/self-custodial/config"
import { useDeleteAccount } from "@app/self-custodial/hooks/use-delete-account"
import { useSparkNetwork } from "@app/self-custodial/hooks/use-spark-network"
import { useSelfCustodialWallet } from "@app/self-custodial/providers/wallet"
import { AccountType } from "@app/types/wallet"
import { hasFunds } from "@app/utils/has-funds"
import { testProps } from "@app/utils/testProps"
import { toastShow } from "@app/utils/toast"

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
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const { activeAccount } = useAccountRegistry()
  const { state, deleteWallet } = useDeleteAccount()
  const { wallets } = useSelfCustodialWallet()
  const network = useSparkNetwork()

  const [confirmVisible, setConfirmVisible] = useState(false)
  const [warningVisible, setWarningVisible] = useState(false)

  const {
    isDeletionBlocked,
    isLoading: isGuardLoading,
    hasRecordError,
    retryRecordRead,
  } = useMigrationDeletionGuard()

  const activeSelfCustodialAccountId =
    activeAccount?.type === AccountType.SelfCustodial ? activeAccount.id : null
  const isDeletionBlockedForWallet =
    activeSelfCustodialAccountId !== null &&
    isDeletionBlocked(activeSelfCustodialAccountId)

  const handleDeletePress = () => {
    if (isDeletionBlockedForWallet) return
    if (!isRegtestNetwork(network) && hasFunds(wallets)) {
      setWarningVisible(true)
      return
    }
    setConfirmVisible(true)
  }

  const handleConfirm = async () => {
    if (activeAccount?.type !== AccountType.SelfCustodial) return
    setConfirmVisible(false)
    const outcome = await deleteWallet(activeAccount.id)

    /** A record that could not be read is not a migration owing funds, so it does not get
     *  that sentence: what went wrong is the read. */
    if (outcome === "record-unavailable") {
      toastShow({ type: "error", message: LL.errors.generic(), LL })
      return
    }

    /** The stored mark outlived the control that offered this: say so rather than close the
     *  modal over a deletion that never happened. */
    if (outcome === "blocked") {
      toastShow({
        type: "error",
        message: LL.SelfCustodialDelete.dangerZoneMigrationPendingNotice(),
        LL,
      })
      return
    }

    if (outcome) navigateAfterAccountDelete(navigation, outcome)
  }

  /**
   * Neither control until the record has been read: offering the button would mean taking
   * it back, and offering the reason would explain something not yet known to be true.
   *
   * A record that could not be read is blocked too, but for a reason the blocked copy does
   * not describe, so it says what actually went wrong rather than leaving the section empty
   * with no button, no reason and nothing to act on.
   */
  const renderDeleteControl = () => {
    if (isGuardLoading) return null
    if (hasRecordError) {
      return (
        <>
          <Text
            type="p2"
            style={styles.blockedNotice}
            {...testProps("self-custodial-danger-zone-record-error")}
          >
            {LL.errors.generic()}
          </Text>
          <SettingsButton
            title={LL.common.tryAgain()}
            variant="warning"
            onPress={() => retryRecordRead()}
            {...testProps("self-custodial-danger-zone-record-retry")}
          />
        </>
      )
    }
    if (isDeletionBlockedForWallet) {
      return (
        <Text
          type="p2"
          style={styles.blockedNotice}
          {...testProps("self-custodial-danger-zone-blocked-notice")}
        >
          {LL.SelfCustodialDelete.dangerZoneMigrationPendingNotice()}
        </Text>
      )
    }
    return (
      <SettingsButton
        title={LL.SelfCustodialDelete.dangerZoneDeleteButton()}
        variant="critical"
        onPress={handleDeletePress}
        {...testProps("self-custodial-danger-zone-delete-button")}
      />
    )
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

      {renderDeleteControl()}

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

const useStyles = makeStyles(({ colors }) => ({
  container: {
    flexDirection: "column",
    rowGap: 18,
    marginTop: 8,
  },
  blockedNotice: {
    color: colors.grey2,
  },
  overlayStyle: {
    backgroundColor: "transparent",
    shadowColor: "transparent",
  },
}))
