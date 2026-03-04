import React, { useState } from "react"
import { Alert, TextInput, View } from "react-native"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import CustomModal from "@app/components/custom-modal/custom-modal"
import { useI18nContext } from "@app/i18n/i18n-react"

type CloseCardModalProps = {
  isVisible: boolean
  onClose: () => void
  onCloseCard: () => void
  loading: boolean
}

export const CloseCardModal: React.FC<CloseCardModalProps> = ({
  isVisible,
  onClose,
  onCloseCard,
  loading,
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

  const userTypedClose =
    confirmText.toLowerCase().trim() ===
    LL.CardFlow.CardSettings.closeCardClose().toLowerCase().trim()

  const handleConfirm = () => {
    if (!userTypedClose) return
    Alert.alert(
      LL.CardFlow.CardSettings.closeCardFinalConfirmTitle(),
      LL.CardFlow.CardSettings.closeCardFinalConfirmMessage(),
      [
        { text: LL.common.cancel() },
        {
          text: LL.common.ok(),
          onPress: onCloseCard,
        },
      ],
    )
  }

  return (
    <CustomModal
      isVisible={isVisible}
      toggleModal={handleClose}
      headerTitle={LL.CardFlow.CardSettings.closeCardAccount()}
      body={
        <View style={styles.body}>
          <Text style={styles.warning}>
            {LL.CardFlow.CardSettings.closeCardWarning()}
          </Text>
          <Text style={styles.instruction}>
            {LL.CardFlow.CardSettings.closeCardTypeClose({
              close: LL.CardFlow.CardSettings.closeCardClose(),
            })}
          </Text>
          <TextInput
            autoCapitalize="none"
            style={styles.textInput}
            onChangeText={setConfirmText}
            value={confirmText}
            placeholder={LL.CardFlow.CardSettings.closeCardClose()}
            placeholderTextColor={colors.grey3}
          />
        </View>
      }
      primaryButtonTitle={LL.common.confirm()}
      primaryButtonOnPress={handleConfirm}
      primaryButtonDisabled={!userTypedClose}
      primaryButtonLoading={loading}
      secondaryButtonTitle={LL.common.cancel()}
      secondaryButtonOnPress={handleClose}
    />
  )
}

const useStyles = makeStyles(({ colors }) => ({
  body: {
    gap: 16,
  },
  warning: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.black,
  },
  instruction: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.grey0,
  },
  textInput: {
    fontSize: 16,
    backgroundColor: colors.grey4,
    padding: 12,
    color: colors.black,
    borderRadius: 8,
  },
}))
