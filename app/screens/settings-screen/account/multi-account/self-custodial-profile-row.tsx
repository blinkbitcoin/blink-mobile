import React, { useState } from "react"
import { ActivityIndicator, TouchableOpacity, View } from "react-native"

import { ListItem, makeStyles, Overlay, Text, useTheme } from "@rn-vui/themed"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { GaloyIconButton } from "@app/components/atomic/galoy-icon-button/galoy-icon-button"
import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { useI18nContext } from "@app/i18n/i18n-react"
import { DeleteAccountConfirmModal } from "@app/screens/settings-screen/self-custodial/delete-account-confirm-modal"
import { useSelfCustodialWallet } from "@app/self-custodial/providers/wallet-provider"
import { AccountType, DefaultAccountId } from "@app/types/wallet.types"
import { testProps } from "@app/utils/testProps"
import { toastShow } from "@app/utils/toast"

import { useDeleteSelfCustodial } from "./hooks/use-delete-self-custodial"

type SelfCustodialProfileRowProps = {
  isFirstItem?: boolean
}

export const SelfCustodialProfileRow: React.FC<SelfCustodialProfileRowProps> = ({
  isFirstItem,
}) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()

  const { accounts, activeAccount, setActiveAccountId } = useAccountRegistry()
  const { lightningAddress } = useSelfCustodialWallet()
  const { state: deleteState, deleteWallet } = useDeleteSelfCustodial()

  const [confirmVisible, setConfirmVisible] = useState(false)

  const selfCustodialAccount = accounts.find((a) => a.type === AccountType.SelfCustodial)

  if (!selfCustodialAccount) return null

  const selected = activeAccount?.type === AccountType.SelfCustodial
  const rowTitle = lightningAddress ?? LL.AccountTypeSelectionScreen.selfCustodialLabel()

  const handleSwitch = () => {
    if (selected) return
    setActiveAccountId(DefaultAccountId.SelfCustodial)
    toastShow({
      type: "success",
      message: LL.ProfileScreen.switchAccount(),
      LL,
    })
  }

  const handleConfirm = async () => {
    setConfirmVisible(false)
    await deleteWallet()
  }

  return (
    <>
      <TouchableOpacity
        onPress={handleSwitch}
        {...testProps("self-custodial-profile-row")}
      >
        <ListItem
          bottomDivider
          containerStyle={[styles.listStyle, isFirstItem && styles.firstItem]}
        >
          {selected ? (
            <GaloyIcon name="check-circle" size={20} color={colors._green} />
          ) : (
            <View style={styles.spacer} />
          )}
          <ListItem.Content>
            <ListItem.Title numberOfLines={1} ellipsizeMode="middle">
              {rowTitle}
            </ListItem.Title>
          </ListItem.Content>
          <GaloyIconButton
            name="close"
            size="small"
            onPress={() => setConfirmVisible(true)}
            backgroundColor={colors.grey4}
            {...testProps("self-custodial-delete-button")}
          />
        </ListItem>
      </TouchableOpacity>
      <Overlay isVisible={deleteState === "deleting"} overlayStyle={styles.overlayStyle}>
        <ActivityIndicator size={50} color={colors.primary} />
        <Text>{LL.AccountScreen.pleaseWait()}</Text>
      </Overlay>
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
  overlayStyle: {
    backgroundColor: "transparent",
    shadowColor: "transparent",
  },
}))
