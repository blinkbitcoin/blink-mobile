import React, { useState } from "react"
import { ActivityIndicator, TextInput, View } from "react-native"

import Modal from "react-native-modal"
import { makeStyles, Overlay, Text, useTheme } from "@rn-vui/themed"

import { GaloyIconButton } from "@app/components/atomic/galoy-icon-button"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { GaloySecondaryButton } from "@app/components/atomic/galoy-secondary-button"
import { InfoCard } from "@app/components/card-screen"
import { useI18nContext } from "@app/i18n/i18n-react"
import { testProps } from "@app/utils/testProps"

import { SettingsButton } from "../../button"
import { useDeleteSelfCustodial } from "../multi-account/hooks/use-delete-self-custodial"

export const SelfCustodialDelete: React.FC = () => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()
  const { state, deleteWallet } = useDeleteSelfCustodial()

  const [confirmText, setConfirmText] = useState("")
  const [modalVisible, setModalVisible] = useState(false)

  const closeModal = () => {
    setModalVisible(false)
    setConfirmText("")
  }

  const handleDelete = async () => {
    closeModal()
    await deleteWallet()
  }

  const userWroteDelete =
    confirmText.trim().toLowerCase() === LL.support.delete().toLowerCase().trim()

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
        onPress={() => setModalVisible(true)}
        {...testProps("self-custodial-danger-zone-delete-button")}
      />

      <Overlay isVisible={state === "deleting"} overlayStyle={styles.overlayStyle}>
        <ActivityIndicator size={50} color={colors.primary} />
        <Text>{LL.AccountScreen.pleaseWait()}</Text>
      </Overlay>

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
              {LL.SelfCustodialDelete.confirmModalTitle()}
            </Text>
            <GaloyIconButton name="close" size="medium" onPress={closeModal} />
          </View>
          <Text type="p1">
            {LL.SelfCustodialDelete.confirmModalTypeToConfirm({
              delete: LL.support.delete(),
            })}
          </Text>
          <TextInput
            autoCapitalize="none"
            style={styles.textInput}
            onChangeText={setConfirmText}
            value={confirmText}
            placeholder={LL.support.delete()}
            placeholderTextColor={colors.grey3}
            {...testProps("self-custodial-danger-zone-delete-input")}
          />
          <View style={styles.modalActions}>
            <GaloyPrimaryButton
              title={LL.common.confirm()}
              disabled={!userWroteDelete}
              onPress={handleDelete}
              {...testProps("self-custodial-danger-zone-delete-confirm")}
            />
            <GaloySecondaryButton title={LL.common.cancel()} onPress={closeModal} />
          </View>
        </View>
      </Modal>
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  container: {
    flexDirection: "column",
    rowGap: 18,
    marginTop: 8,
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
