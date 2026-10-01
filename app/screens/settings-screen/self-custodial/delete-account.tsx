import React, { useState } from "react"
import { View } from "react-native"

import { makeStyles } from "@rn-vui/themed"

import { InfoCard } from "@app/components/card-screen"
import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { useI18nContext } from "@app/i18n/i18n-react"
import { isRegtestNetwork } from "@app/self-custodial/config"
import { useSparkNetwork } from "@app/self-custodial/hooks/use-spark-network"
import { useSelfCustodialWallet } from "@app/self-custodial/providers/wallet"
import { AccountType } from "@app/types/wallet"
import { hasFunds } from "@app/utils/has-funds"
import { extractLightningAddressUsername } from "@app/utils/pay-links"
import { testProps } from "@app/utils/testProps"

import { SettingsButton } from "../button"

import { DeleteAccountConfirmModal } from "./delete-account-confirm-modal"
import { DeleteAccountHasFundsModal } from "./delete-account-has-funds-modal"
import { useAccountRemoval } from "./use-account-removal"

export const DeleteAccount: React.FC = () => {
  const styles = useStyles()
  const { LL } = useI18nContext()
  const { activeAccount } = useAccountRegistry()
  const { requestRemoval, runPendingRemoval } = useAccountRemoval()
  const { wallets, lightningAddress } = useSelfCustodialWallet()
  const network = useSparkNetwork()

  const [confirmVisible, setConfirmVisible] = useState(false)
  const [warningVisible, setWarningVisible] = useState(false)

  const handleDeletePress = () => {
    if (!isRegtestNetwork(network) && hasFunds(wallets)) {
      setWarningVisible(true)
      return
    }
    setConfirmVisible(true)
  }

  const handleConfirm = () => {
    if (activeAccount?.type !== AccountType.SelfCustodial) return
    const identifier =
      extractLightningAddressUsername(lightningAddress) ?? LL.common.anonymousUser()
    requestRemoval(activeAccount.id, identifier)
    setConfirmVisible(false)
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

      <DeleteAccountHasFundsModal
        isVisible={warningVisible}
        onClose={() => setWarningVisible(false)}
        wallets={wallets}
      />

      <DeleteAccountConfirmModal
        isVisible={confirmVisible}
        onClose={() => setConfirmVisible(false)}
        onConfirm={handleConfirm}
        onModalHide={runPendingRemoval}
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
}))
