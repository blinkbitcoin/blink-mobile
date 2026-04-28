import React, { useState } from "react"
import { ActivityIndicator, TextInput, TouchableOpacity, View } from "react-native"

import Modal from "react-native-modal"
import { ListItem, makeStyles, Overlay, Text, useTheme } from "@rn-vui/themed"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { GaloyIconButton } from "@app/components/atomic/galoy-icon-button/galoy-icon-button"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { GaloySecondaryButton } from "@app/components/atomic/galoy-secondary-button"
import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { useI18nContext } from "@app/i18n/i18n-react"
import {
  BackupStatus,
  useBackupState,
} from "@app/self-custodial/providers/backup-state-provider"
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
  const { backupState } = useBackupState()
  const { state: deleteState, deleteWallet } = useDeleteSelfCustodial()

  const [confirmText, setConfirmText] = useState("")
  const [modalVisible, setModalVisible] = useState(false)

  const selfCustodialAccount = accounts.find((a) => a.type === AccountType.SelfCustodial)

  if (!selfCustodialAccount) return null

  const selected = activeAccount?.type === AccountType.SelfCustodial
  const isBackedUp = backupState.status === BackupStatus.Completed

  const closeModal = () => {
    setModalVisible(false)
    setConfirmText("")
  }

  const handleSwitch = () => {
    if (selected) return
    setActiveAccountId(DefaultAccountId.SelfCustodial)
    toastShow({
      type: "success",
      message: LL.ProfileScreen.switchAccount(),
      LL,
    })
  }

  const handleDelete = async () => {
    closeModal()
    await deleteWallet()
  }

  const userWroteDelete =
    confirmText.trim().toLowerCase() === LL.support.delete().toLowerCase().trim()

  const deleteModal = (
    <Modal
      animationOut="fadeOut"
      animationIn="fadeIn"
      isVisible={modalVisible}
      onBackdropPress={closeModal}
      backdropColor={colors.white}
      avoidKeyboard
      backdropTransitionOutTiming={0}
    >
      <View style={styles.modalView}>
        <View style={styles.modalHeader}>
          <Text type="h1" bold>
            {LL.SelfCustodialDelete.title()}
          </Text>
          <GaloyIconButton name="close" size="medium" onPress={closeModal} />
        </View>
        <Text type="p1">{LL.SelfCustodialDelete.warning()}</Text>
        <Text type="p2" style={styles.subtleText}>
          {LL.SelfCustodialDelete.recoveryNote()}
        </Text>
        <Text type="p1">{LL.support.typeDelete({ delete: LL.support.delete() })}</Text>
        <TextInput
          autoCapitalize="none"
          style={styles.textInput}
          onChangeText={setConfirmText}
          value={confirmText}
          placeholder={LL.support.delete()}
          placeholderTextColor={colors.grey3}
          {...testProps("self-custodial-delete-input")}
        />
        <View style={styles.modalActions}>
          <GaloyPrimaryButton
            title={LL.common.confirm()}
            disabled={!userWroteDelete}
            onPress={handleDelete}
            {...testProps("self-custodial-delete-confirm")}
          />
          <GaloySecondaryButton title={LL.common.cancel()} onPress={closeModal} />
        </View>
      </View>
    </Modal>
  )

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
            <ListItem.Title>
              {LL.AccountTypeSelectionScreen.selfCustodialLabel()}
            </ListItem.Title>
            <Text type="p3" style={styles.subtleText}>
              {isBackedUp
                ? LL.SelfCustodialDelete.backupBadgeCompleted()
                : LL.SelfCustodialDelete.backupBadgeMissing()}
            </Text>
          </ListItem.Content>
          <GaloyIconButton
            name="close"
            size="small"
            onPress={() => setModalVisible(true)}
            backgroundColor={colors.grey4}
            {...testProps("self-custodial-delete-button")}
          />
        </ListItem>
      </TouchableOpacity>
      <Overlay isVisible={deleteState === "deleting"} overlayStyle={styles.overlayStyle}>
        <ActivityIndicator size={50} color={colors.primary} />
        <Text>{LL.AccountScreen.pleaseWait()}</Text>
      </Overlay>
      {deleteModal}
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
  modalView: {
    marginHorizontal: 20,
    backgroundColor: colors.grey5,
    padding: 20,
    borderRadius: 20,
    flexDirection: "column",
    rowGap: 16,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  textInput: {
    fontSize: 16,
    backgroundColor: colors.grey4,
    padding: 12,
    color: colors.black,
    borderRadius: 8,
  },
}))
