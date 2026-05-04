import React, { useState } from "react"
import { TextInput, View } from "react-native"

import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import CustomModal from "@app/components/custom-modal/custom-modal"
import { useI18nContext } from "@app/i18n/i18n-react"
import { testProps } from "@app/utils/testProps"

type Props = {
  isVisible: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
}

export const DeleteAccountConfirmModal: React.FC<Props> = ({
  isVisible,
  onClose,
  onConfirm,
}) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()
  const [confirmText, setConfirmText] = useState("")

  const handleClose = () => {
    setConfirmText("")
    onClose()
  }

  const handleConfirm = async () => {
    setConfirmText("")
    await onConfirm()
  }

  const matchesDelete =
    confirmText.trim().toLowerCase() === LL.support.delete().toLowerCase().trim()

  return (
    <CustomModal
      isVisible={isVisible}
      toggleModal={handleClose}
      showCloseIconButton={true}
      title={LL.SelfCustodialDelete.confirmModalTitle()}
      body={
        <View style={styles.body}>
          <Text style={styles.paragraph}>
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
        </View>
      }
      primaryButtonTitle={LL.common.confirm()}
      primaryButtonDisabled={!matchesDelete}
      primaryButtonOnPress={handleConfirm}
      secondaryButtonTitle={LL.common.cancel()}
      secondaryButtonOnPress={handleClose}
      {...testProps("self-custodial-confirm-removal-modal")}
    />
  )
}

const useStyles = makeStyles(({ colors }) => ({
  body: {
    rowGap: 16,
  },
  paragraph: {
    fontSize: 16,
    lineHeight: 22,
    textAlign: "center",
    color: colors.black,
  },
  textInput: {
    fontSize: 16,
    backgroundColor: colors.grey4,
    padding: 12,
    color: colors.black,
    borderRadius: 8,
    textAlign: "center",
  },
}))
